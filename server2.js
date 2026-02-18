'use strict';

const express = require('express');
const {
  Server
} = require('ws');

const PORT = process.env.PORT || 10000;
//const INDEX = '/index.html';

const server = express()
  .use('/', express.static(__dirname + '/'))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({
  server
});

const TRANSPORT_DEFAULT_BPM = 60;
const TRANSPORT_START_LEAD_MS = 350;
const TEMPO_TABLE_BPM = [50, 65, 85, 110];
var scoreClients = [];
//var snakeClient = null;
//var snakeClientIP = null;
var roomCounter = 0;
var rooms = [];

function createInitialTransport(nowMs) {
  var baseNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  return {
    epochMs: Math.round(baseNow + TRANSPORT_START_LEAD_MS),
    bpm: TRANSPORT_DEFAULT_BPM,
    revision: 1,
  };
}

function clampTransportBpm(bpm) {
  var numeric = Number(bpm);
  if (!Number.isFinite(numeric)) {
    return TRANSPORT_DEFAULT_BPM;
  }
  return Math.max(20, Math.min(280, numeric));
}

function sanitizeTempoTable(rawTable) {
  if (!Array.isArray(rawTable) || rawTable.length === 0) {
    return [TRANSPORT_DEFAULT_BPM];
  }
  return rawTable
    .map(function (value) {
      return clampTransportBpm(value);
    })
    .filter(function (value) {
      return Number.isFinite(value);
    });
}

const RESOLVED_TEMPO_TABLE_BPM = sanitizeTempoTable(TEMPO_TABLE_BPM);

function tempoControlToBpm(controlValue) {
  var control = Number(controlValue);
  if (!Number.isFinite(control)) {
    return null;
  }
  // Snake sends tempo bins as 1..N.
  var index = Math.round(control) - 1;
  if (!Number.isFinite(index)) {
    return null;
  }
  index = Math.max(0, Math.min(RESOLVED_TEMPO_TABLE_BPM.length - 1, index));
  return clampTransportBpm(RESOLVED_TEMPO_TABLE_BPM[index]);
}

function buildTempoTableMessage() {
  return 'TEMPO_TABLE ' + RESOLVED_TEMPO_TABLE_BPM.map(function (value) {
    return Number(value).toFixed(3);
  }).join(' ');
}

function sendTempoTableToClient(client) {
  if (!client || client.readyState !== 1) {
    return;
  }
  client.send(buildTempoTableMessage());
}

function ensureRoomTransport(room, nowMs) {
  if (!room) {
    return null;
  }
  if (!room.transport) {
    room.transport = createInitialTransport(nowMs);
  }
  if (!Number.isFinite(Number(room.transport.epochMs)) || !Number.isFinite(Number(room.transport.bpm))) {
    room.transport = createInitialTransport(nowMs);
  }
  if (!Number.isFinite(Number(room.transport.revision)) || Number(room.transport.revision) <= 0) {
    room.transport.revision = 1;
  }
  return room.transport;
}

function buildTransportMessage(room, serverNowMs) {
  var transport = ensureRoomTransport(room, Date.now());
  if (!transport) {
    return null;
  }
  var serverNow = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  return 'TRANSPORT ' +
    Math.round(Number(transport.epochMs)) + ' ' +
    Number(transport.bpm).toFixed(3) + ' ' +
    Math.floor(Number(transport.revision)) + ' ' +
    Math.round(serverNow);
}

function sendTransportToClient(client, room) {
  if (!client || client.readyState !== 1 || !room) {
    return;
  }
  var message = buildTransportMessage(room, Date.now());
  if (message) {
    client.send(message);
  }
}

function maybeUpdateRoomTransportFromTempoMessage(room, message, serverNow) {
  if (!room || typeof message !== 'string' || !message.startsWith('tempo')) {
    return false;
  }
  var parts = message.trim().split(/\s+/);
  if (parts.length < 2) {
    return false;
  }
  var newBpm = tempoControlToBpm(parts[1]);
  if (!Number.isFinite(newBpm)) {
    return false;
  }

  var transport = ensureRoomTransport(room, serverNow);
  var oldBpm = clampTransportBpm(transport.bpm);
  var oldEpochMs = Number(transport.epochMs);
  var now = Number.isFinite(Number(serverNow)) ? Number(serverNow) : Date.now();
  if (!Number.isFinite(oldEpochMs)) {
    oldEpochMs = now + TRANSPORT_START_LEAD_MS;
  }

  var progressedQuarters = (now - oldEpochMs) * (oldBpm / 60) / 1000;
  var newEpochMs = now - progressedQuarters * (60 / newBpm) * 1000;
  transport.epochMs = Math.round(newEpochMs);
  transport.bpm = newBpm;
  transport.revision = Math.floor(Number(transport.revision) || 0) + 1;
  return true;
}

class Room {
  constructor(ws, snakeIP) {
    this.snakeWS = ws;
    this.snakeIP = snakeIP;
    this.clients = [];
    this.ID = roomCounter + 1;
    this.transport = createInitialTransport(Date.now());
    roomCounter++;
  }
  update() {
    this.snakeWS.send('CLIENTS ' + this.clients.length);
  }
}

function getRoomOfSnake(ws) {
  var room = null;
  rooms.forEach(element => {
    if (element.snakeWS === ws) {
      room = element;
    }
  });
  return room;
}

function getRoomOfClient(ws) {
  var room = null;
  rooms.forEach(element => {
    if (element.clients.includes(ws)) {
      room = element;
    }
  });
  return room;
}

function getRoomByID(id) {
  var room = null;
  rooms.forEach(element => {
    //console.log(element.ID + " xx " + id);
    if (element.ID === id) {
      room = element;
    }
  });
  return room;
}

function removeClient(ws) {
  var room = getRoomOfClient(ws);
  if (room) {
    console.log('room existed ' + room.ID)
    room.clients.splice(room.clients.indexOf(ws), 1);
    room.update();
    return room;
  } else
    return null;
}

function getAllIDs() {
  var ids = [];
  rooms.forEach(element => {
    ids.push(element.ID);
  });
  return ids;
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  ws.clockSyncEnabled = false;
  //ws.client.send('WHOAREYOU');
  //console.log(ws);

  ws.on('close', () => {
    console.log('disconnection');
    if (scoreClients.includes(ws)) {
      //IF A SCORE DISCONNECTS
      scoreClients.splice(scoreClients.indexOf(ws), 1);
      if (rooms.length > 0) {
        var room = removeClient(ws);
        if (room)
          room.update();
      }
      console.log('at ' + new Date().toLocaleTimeString() +
        ' Score client DISCONNECTED IP: ' + ip);
    } else {
      //IF A SNAKE DISCONNECTS
      var room = getRoomOfSnake(ws);
      if (room) {
        console.log('at ' + new Date().toLocaleTimeString() +
          //' Snake/tetris DISCONNECTED IP: ' + room.snakeClientIP + " ID: " + room.ID);
          ' Snake/tetris DISCONNECTED IP: ' + room.snakeIP + " ID: " + room.ID);
        var room = getRoomOfSnake(ws);
        rooms.splice(rooms.indexOf(room), 1);
        scoreClients.forEach(element =>
          element.send('IDS ' + getAllIDs()));
      }
    }
  });

  ws.on('message', function (data) {
    var message = typeof data === 'string' ? data : data.toString();
    //console.log(ws === snakeClient);
    //console.log(data);
    if (message.startsWith('IAMSNAKE')) {
      //SNAKE IS TRYING TO LOG IN
      var id = message.replace('IAMSNAKE ', '');
      var room = getRoomByID(Number(id));
      if (room) {
        room.snakeWS = ws;
        room.snakeIP = ip;
        ensureRoomTransport(room, Date.now());
      } else {
        room = new Room(ws, ip)
        rooms.push(room);
      }
      //TELL SNAKE ITS id NUMBER
      ws.send('ACCEPTED ' + room.ID);

      //WARN ALL SCORES ABOUT A NEW SNAKE
      if (rooms.length > 0)
        scoreClients.forEach(element =>
          element.send('IDS ' + getAllIDs()));

      console.log('at ' + new Date().toLocaleTimeString() +
        ' Snake/tetris host IP: ' + ip + " ID: " + room.ID);

    } else if (message === 'IAMSCORE') {
      //SCORE IS TRYING TO LOG IN
      scoreClients.push(ws);
      sendTempoTableToClient(ws);
      if (rooms.length > 0)
        ws.send('IDS ' + getAllIDs());
      console.log('at ' + new Date().toLocaleTimeString() +
        ' New score client added, now total: ' + scoreClients.length);
    } else if (message.startsWith('JOIN')) {
      //SCORE JOINS A ROOM
      var id = Number(message.replace('JOIN ', ''));
      if (rooms.length > 0) {
        removeClient(ws);
        var room = getRoomByID(id)
        if (room) {
          room.clients.push(ws);
          room.update();
          sendTempoTableToClient(ws);
          sendTransportToClient(ws, room);
        }
      }
    } else if (message === 'BACK') {
      //SCORE EXITS ROOM
      if (rooms.length > 0) {
        removeClient(ws);
      }
    } else if (scoreClients.includes(ws) && message.startsWith('SYNC ')) {
      // SCORE CLOCK SYNC REQUEST
      var clientSentAt = Number(message.replace('SYNC ', ''));
      if (Number.isFinite(clientSentAt)) {
        ws.clockSyncEnabled = true;
        ws.send('SYNC ' + clientSentAt + ' ' + Date.now());
      }
      if (rooms.length > 0) {
        var syncRoom = getRoomOfClient(ws);
        if (syncRoom) {
          sendTransportToClient(ws, syncRoom);
        }
      }
    } else if (scoreClients.includes(ws)) {
      //SCORE SENDS MESSAGE TO SNAKE
      if (rooms.length > 0) {
        var room = getRoomOfClient(ws)
        if (room)
          room.snakeWS.send(message);
      }
    } else {
      //SNAKE SENDS MESSAGE TO CLIENTS
      console.log(message);
      if (rooms.length > 0) {
        var room = getRoomOfSnake(ws);
        if (!room) {
          return;
        }
        var clients = room.clients;
        var serverNow = Date.now();
        maybeUpdateRoomTransportFromTempoMessage(room, message, serverNow);
        var transportMessage = buildTransportMessage(room, serverNow);
        if (clients.length > 0)
          clients.forEach(element => {
            if (element.clockSyncEnabled) {
              element.send('SRVTIME ' + serverNow);
            }
            if (transportMessage) {
              element.send(transportMessage);
            }
            element.send(message);
          });
      }
    }
  });
});

// setInterval(() => {
//   wss.clients.forEach((client) => {
//     client.send(new Date().toTimeString());
//   });
// }, 1000);
