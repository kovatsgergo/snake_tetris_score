'use strict';

const express = require('express');
const path = require('path');
const { Server } = require('ws');

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || "127.0.0.1";
const appConfig = require('./config.js');

const app = express();

app.get('/score', function (_req, res) {
  res.sendFile(path.join(__dirname, 'score7.html'));
});

app.get('/index7.html', function (_req, res) {
  res.sendFile(path.join(__dirname, 'score7.html'));
});

app.get('/conductor', function (_req, res) {
  res.sendFile(path.join(__dirname, 'conductor7.html'));
});

app.use('/', express.static(__dirname + '/'));

const server = app.listen(PORT, HOST, () => console.log(`Listening on http://${HOST}:${PORT}`));

const wss = new Server({ server });

const TRANSPORT_DEFAULT_BPM = 60;
const TRANSPORT_TICK_MS = 25;

const TEMPO_TABLE_BPM = appConfig.TEMPO_TABLE_BPM;
const TRANSPOSE_MIN = (typeof appConfig.TRANSPOSE_MIN === 'number') ? appConfig.TRANSPOSE_MIN : -6;

var scoreClients = [];
var roomCounter = 0;
var rooms = [];

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

function getDefaultBpm() {
  var table = RESOLVED_TEMPO_TABLE_BPM;
  if (table.length >= 2) {
    return table[1];
  }
  if (table.length === 1) {
    return table[0];
  }
  return TRANSPORT_DEFAULT_BPM;
}

function getDefaultTempoIndex() {
  if (RESOLVED_TEMPO_TABLE_BPM.length >= 2) {
    return 1;
  }
  return 0;
}

function clampTempoIndex(index) {
  var numeric = Number(index);
  if (!Number.isFinite(numeric)) {
    return getDefaultTempoIndex();
  }
  var intIndex = Math.floor(numeric);
  return Math.max(0, Math.min(RESOLVED_TEMPO_TABLE_BPM.length - 1, intIndex));
}

function tempoIndexToBpm(index) {
  var safeIndex = clampTempoIndex(index);
  return clampTransportBpm(RESOLVED_TEMPO_TABLE_BPM[safeIndex]);
}

function tempoControlToIndex(controlValue) {
  var control = Number(controlValue);
  if (!Number.isFinite(control)) {
    return null;
  }
  var index = Math.round(control) - 1;
  if (!Number.isFinite(index)) {
    return null;
  }
  return clampTempoIndex(index);
}

function tempoControlToBpm(controlValue) {
  var index = tempoControlToIndex(controlValue);
  if (!Number.isFinite(index)) {
    return null;
  }
  return tempoIndexToBpm(index);
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

function buildDefaultSnakeMessage() {
  return 'snake 3 0 2 0 1 0 0 0';
}

function buildDefaultEatenMessage() {
  var hueBin = -TRANSPOSE_MIN;
  return 'eaten 0 0 4 ' + hueBin + ' 3 1';
}

function buildInitialStateMessage(eatenMsg, snakeMsg) {
  var eatenPayload = String(eatenMsg || '').replace(/^eaten\s*/, '').trim();
  var snakePayload = String(snakeMsg || '').replace(/^snake\s*/, '').trim();
  return 'INITIAL_STATE ' + eatenPayload + ' snake ' + snakePayload;
}

function resolveRunningControlFromMessage(message) {
  if (typeof message !== 'string') {
    return null;
  }
  var normalized = message.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  if (
    normalized === 'PAUSE' ||
    normalized === 'PAUSED' ||
    normalized === 'STOP' ||
    normalized === 'RUN 0' ||
    normalized === 'RUNNING 0' ||
    normalized === 'PLAY 0' ||
    normalized === 'TRANSPORT_PAUSE'
  ) {
    return false;
  }
  if (
    normalized === 'RESUME' ||
    normalized === 'UNPAUSE' ||
    normalized === 'START' ||
    normalized === 'PLAY' ||
    normalized === 'RUN 1' ||
    normalized === 'RUNNING 1' ||
    normalized === 'PLAY 1' ||
    normalized === 'TRANSPORT_RESUME'
  ) {
    return true;
  }
  return null;
}

function parseSnakePhrase(message) {
  if (typeof message !== 'string' || !message.startsWith('snake ')) {
    return null;
  }
  var nums = message.slice(6).trim().split(/\s+/).map(Number).filter(Number.isFinite);
  if (nums.length < 4) {
    return null;
  }
  var headX = Number(nums[nums.length - 2]);
  var headY = Number(nums[nums.length - 1]);
  if (!Number.isFinite(headX) || !Number.isFinite(headY)) {
    return null;
  }
  var fromQuarter = Math.max(0, Math.floor(headY * 16 + headX));
  var numQuarters = Math.max(1, Math.floor(nums.length / 2));
  return {
    fromQuarter: fromQuarter,
    numQuarters: numQuarters,
  };
}

function parseEatenInfo(message) {
  if (typeof message !== 'string' || !message.startsWith('eaten ')) {
    return null;
  }
  var nums = message.slice(6).trim().split(/\s+/).map(Number).filter(Number.isFinite);
  if (nums.length < 6) {
    return null;
  }
  var hueBin = Number(nums[3]);
  var transpose = Number.isFinite(hueBin) ? Math.round(hueBin + TRANSPOSE_MIN) : 0;
  return {
    transpose: transpose,
    rawMessage: message,
  };
}

function buildTacetMessage(message, staffCount) {
  if (!message.startsWith('eaten ')) return null;
  var tokens = message.slice(6).trim().split(/\s+/).map(Number);
  if (tokens.length < 5 || !Number.isFinite(tokens[4])) return null;
  var satBin = Math.round(tokens[4]);
  var tacetCount = Math.max(0, Math.min(3, 3 - satBin));
  if (tacetCount === 0) return 'TACET';
  var count = (Number.isFinite(staffCount) && staffCount > 0) ? staffCount : 3;
  var indices = [];
  for (var j = 0; j < count; j++) indices.push(j);
  for (var k = indices.length - 1; k > 0; k--) {
    var swapIndex = Math.floor(Math.random() * (k + 1));
    var tmp = indices[k]; indices[k] = indices[swapIndex]; indices[swapIndex] = tmp;
  }
  return 'TACET ' + indices.slice(0, tacetCount).join(' ');
}

function normalizeDynamicsPayload(message) {
  if (typeof message !== 'string' || !message.startsWith('dynam')) {
    return '';
  }
  var payload = message.replace(/^dynam\s*/, '').trim();
  if (!payload) {
    return '';
  }
  var values = payload.split(/\s+/).map(Number).filter(Number.isFinite);
  if (values.length === 0) {
    return '';
  }
  return values.join(',');
}

function buildRoomClockMessage(room, serverNowMs) {
  var now = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  var beatsPerPhrase = Math.max(1, Math.floor(Number(room.transport.beatsPerPhrase) || Number(room.currentNumQuarters) || 1));
  var quarterCounter = Math.max(0, Math.floor(Number(room.transport.quarterCounter) || 0));
  var beatInPhrase = quarterCounter <= 0
    ? 1
    : Math.max(1, Math.min(beatsPerPhrase, Math.floor(Number(room.transport.beatInPhrase) || 1)));
  return 'ROOM_CLOCK ' +
    room.ID + ' ' +
    quarterCounter + ' ' +
    beatInPhrase + ' ' +
    beatsPerPhrase + ' ' +
    clampTransportBpm(room.transport.bpm).toFixed(3) + ' ' +
    Math.round(now);
}

function buildRoomStateMessage(room, serverNowMs) {
  var now = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  var candidateFrom = room.hasCandidate ? room.candidateFromQuarter : -1;
  var candidateNum = room.hasCandidate ? room.candidateNumQuarters : -1;
  var candidateTranspose = room.hasCandidate ? room.candidateTranspose : -1;
  var currentPhraseSeq = Number.isFinite(Number(room.currentPhraseSeq)) && Number(room.currentPhraseSeq) >= 0
    ? Math.floor(Number(room.currentPhraseSeq))
    : 0;
  var candidatePhraseSeq = room.hasCandidate && Number.isFinite(Number(room.candidatePhraseSeq)) && Number(room.candidatePhraseSeq) >= 0
    ? Math.floor(Number(room.candidatePhraseSeq))
    : -1;
  var pendingTempo = Number.isFinite(Number(room.transport && room.transport.pendingTempoBpm))
    ? clampTransportBpm(room.transport.pendingTempoBpm).toFixed(3)
    : '-1';
  var dynamicsVersion = Math.max(0, Math.floor(Number(room.currentDynamicsVersion) || 0));
  var dynamicsPayload = room.currentDynamicsPayload ? String(room.currentDynamicsPayload).trim() : '';
  if (!dynamicsPayload) {
    dynamicsPayload = '-';
  }

  return 'ROOM_STATE ' +
    room.ID + ' ' +
    Math.floor(Number(room.stateVersion) || 1) + ' ' +
    (room.snakePaused ? 1 : 0) + ' ' +
    Math.floor(Number(room.currentFromQuarter) || 0) + ' ' +
    Math.max(1, Math.floor(Number(room.currentNumQuarters) || 1)) + ' ' +
    Math.floor(Number(room.currentTranspose) || 0) + ' ' +
    Math.floor(Number(candidateFrom) || -1) + ' ' +
    Math.floor(Number(candidateNum) || -1) + ' ' +
    Math.floor(Number(candidateTranspose) || -1) + ' ' +
    pendingTempo + ' ' +
    clampTransportBpm(room.transport.bpm).toFixed(3) + ' ' +
    Math.round(now) + ' ' +
    dynamicsVersion + ' ' +
    dynamicsPayload + ' ' +
    currentPhraseSeq + ' ' +
    candidatePhraseSeq;
}

function buildRoomTempoControlMessage(room) {
  if (!room) {
    return '';
  }
  return 'ROOM_TEMPO_CONTROL ' +
    room.ID + ' ' +
    (room.tempoAutoEnabled ? 1 : 0) + ' ' +
    clampTempoIndex(room.tempoControlIndex);
}

function sendRoomClockToClient(client, room, serverNowMs) {
  if (!client || client.readyState !== 1 || !room) {
    return;
  }
  var now = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  client.send('SRVTIME ' + now);
  client.send(buildRoomClockMessage(room, now));
}

function sendRoomStateToClient(client, room, serverNowMs) {
  if (!client || client.readyState !== 1 || !room) {
    return;
  }
  var now = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  client.send('SRVTIME ' + now);
  client.send(buildRoomStateMessage(room, now));
}

function sendRoomTempoControlToClient(client, room) {
  if (!client || client.readyState !== 1 || !room) {
    return;
  }
  client.send(buildRoomTempoControlMessage(room));
}

function broadcastRoomClock(room, serverNowMs) {
  if (!room || !room.clients || room.clients.length === 0) {
    return;
  }
  var now = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  var clockMessage = buildRoomClockMessage(room, now);
  room.clients.forEach(function (client) {
    if (!client || client.readyState !== 1) {
      return;
    }
    client.send('SRVTIME ' + now);
    client.send(clockMessage);
  });
}

function broadcastRoomTempoControl(room) {
  if (!room || !room.clients || room.clients.length === 0) {
    return;
  }
  var tempoControlMessage = buildRoomTempoControlMessage(room);
  room.clients.forEach(function (client) {
    if (!client || client.readyState !== 1) {
      return;
    }
    client.send(tempoControlMessage);
  });
}

function broadcastRoomState(room, serverNowMs) {
  if (!room || !room.clients || room.clients.length === 0) {
    return;
  }
  var now = Number.isFinite(Number(serverNowMs)) ? Number(serverNowMs) : Date.now();
  var stateMessage = buildRoomStateMessage(room, now);
  room.clients.forEach(function (client) {
    if (!client || client.readyState !== 1) {
      return;
    }
    client.send('SRVTIME ' + now);
    client.send(stateMessage);
  });
}

function parseClientTempoControlMessage(message) {
  if (typeof message !== 'string' || !message.startsWith('ROOM_TEMPO_CONTROL ')) {
    return null;
  }
  var parts = message.trim().split(/\s+/);
  if (parts.length < 3) {
    return null;
  }
  var autoToken = String(parts[1]).trim().toLowerCase();
  var autoEnabled = autoToken === '1' || autoToken === 'true' || autoToken === 'on';
  var index = clampTempoIndex(parts[2]);
  return {
    autoEnabled: autoEnabled,
    tempoIndex: index,
  };
}

function broadcastToRoomClients(room, message) {
  if (!room || !room.clients || room.clients.length === 0) {
    return;
  }
  room.clients.forEach(function (client) {
    if (client && client.readyState === 1) {
      client.send(message);
    }
  });
}

function markStateChanged(room) {
  if (!room) {
    return;
  }
  room.stateVersion = Math.floor(Number(room.stateVersion) || 0) + 1;
}

function promoteCandidateIfAvailable(room, nowMs) {
  if (!room || !room.hasCandidate) {
    return false;
  }
  room.currentFromQuarter = room.candidateFromQuarter;
  room.currentNumQuarters = room.candidateNumQuarters;
  room.currentTranspose = room.candidateTranspose;
  if (Number.isFinite(Number(room.candidatePhraseSeq)) && Number(room.candidatePhraseSeq) >= 0) {
    room.currentPhraseSeq = Math.floor(Number(room.candidatePhraseSeq));
  }
  room.transport.beatsPerPhrase = Math.max(1, Math.floor(Number(room.currentNumQuarters) || 1));
  room.candidateFromQuarter = -1;
  room.candidateNumQuarters = -1;
  room.candidateTranspose = -1;
  room.candidatePhraseSeq = -1;
  room.hasCandidate = false;
  markStateChanged(room);
  void nowMs;
  return true;
}

function requestBoundaryDynamicsFromSnake(room, nowMs) {
  if (!room || !room.snakeWS || room.snakeWS.readyState !== 1) {
    return;
  }
  var now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  var quarterCounter = Math.max(0, Math.floor(Number(room.transport.quarterCounter) || 0));
  room.awaitingBoundaryDynamics = true;
  room.lastBoundaryDynamicsRequestMs = now;
  room.lastBoundaryDynamicsRequestQuarter = quarterCounter;
  room.snakeWS.send('snake');
}

function applyDynamicsSnapshot(room, message, nowMs) {
  if (!room || typeof message !== 'string' || !message.startsWith('dynam')) {
    return false;
  }
  var payload = normalizeDynamicsPayload(message);
  if (!payload) {
    return false;
  }
  var now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  room.currentDynamicsMessage = message;
  room.currentDynamicsPayload = payload;
  room.currentDynamicsVersion = Math.max(0, Math.floor(Number(room.currentDynamicsVersion) || 0)) + 1;
  room.awaitingBoundaryDynamics = false;
  markStateChanged(room);
  broadcastToRoomClients(room, room.currentDynamicsMessage);
  broadcastRoomState(room, now);
  return true;
}

function applyQueuedBoundaryUpdates(room, nowMs) {
  if (!room) {
    return;
  }
  var changed = false;

  if (Number.isFinite(Number(room.transport && room.transport.pendingTempoBpm))) {
    var nextBpm = clampTransportBpm(room.transport.pendingTempoBpm);
    if (Math.abs(nextBpm - Number(room.transport.bpm)) > 1e-6) {
      room.transport.bpm = nextBpm;
      changed = true;
      console.log('ROOM ' + room.ID + ' tempo applied at phrase boundary: ' + nextBpm.toFixed(3));
    }
    room.transport.pendingTempoBpm = Number.NaN;
  }

  if (promoteCandidateIfAvailable(room, nowMs)) {
    changed = true;
  }

  if (changed) {
    broadcastRoomState(room, nowMs);
  }
  requestBoundaryDynamicsFromSnake(room, nowMs);
}

function advanceRoomClock(room, nowMs) {
  if (!room) {
    return;
  }
  var now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  var last = Number(room.transport.lastAdvanceMs);
  if (!Number.isFinite(last)) {
    room.transport.lastAdvanceMs = now;
    return;
  }

  var deltaMs = now - last;
  if (deltaMs > 0) {
    room.transport.quarters += deltaMs * clampTransportBpm(room.transport.bpm) / 60000;
    room.transport.lastAdvanceMs = now;
  }

  var oldQuarterCounter = Math.max(0, Math.floor(Number(room.transport.quarterCounter) || 0));
  var newQuarterCounter = Math.max(0, Math.floor(Number(room.transport.quarters) + 1e-9));
  if (newQuarterCounter <= oldQuarterCounter) {
    return;
  }

  var beatInPhrase = Math.floor(Number(room.transport.beatInPhrase) || 0);
  if (!Number.isFinite(beatInPhrase) || beatInPhrase < 0) {
    beatInPhrase = 0;
  }
  for (var q = oldQuarterCounter + 1; q <= newQuarterCounter; q++) {
    room.transport.quarterCounter = q;
    var beatsPerPhrase = Math.max(1, Math.floor(Number(room.currentNumQuarters) || 1));
    beatInPhrase += 1;
    if (beatInPhrase > beatsPerPhrase) {
      beatInPhrase = 1;
    }
    if (beatInPhrase === 1) {
      applyQueuedBoundaryUpdates(room, now);
      beatsPerPhrase = Math.max(1, Math.floor(Number(room.currentNumQuarters) || 1));
    }
    room.transport.beatInPhrase = beatInPhrase;
    room.transport.beatsPerPhrase = beatsPerPhrase;
    broadcastRoomClock(room, now);
  }
}

class Room {
  constructor(ws, snakeIP) {
    var now = Date.now();
    var defaultPhrase = parseSnakePhrase(buildDefaultSnakeMessage()) || {
      fromQuarter: 0,
      numQuarters: 4,
    };

    this.snakeWS = ws;
    this.snakeIP = snakeIP;
    this.clients = [];
    this.ID = roomCounter + 1;

    this.transport = {
      bpm: getDefaultBpm(),
      pendingTempoBpm: Number.NaN,
      quarters: 0,
      quarterCounter: 0,
      beatInPhrase: 0,
      beatsPerPhrase: Math.max(1, defaultPhrase.numQuarters),
      lastAdvanceMs: now,
    };

    this.stateVersion = 1;
    this.snakePaused = false;

    this.currentFromQuarter = defaultPhrase.fromQuarter;
    this.currentNumQuarters = Math.max(1, defaultPhrase.numQuarters);
    this.currentTranspose = 0;
    this.currentPhraseSeq = 0;

    this.hasCandidate = false;
    this.candidateFromQuarter = -1;
    this.candidateNumQuarters = -1;
    this.candidateTranspose = -1;
    this.candidatePhraseSeq = -1;
    this.nextPhraseSeq = 1;

    this.pendingEatenInfo = null;
    this.currentDynamicsMessage = '';
    this.currentDynamicsPayload = '';
    this.currentDynamicsVersion = 0;
    this.awaitingBoundaryDynamics = false;
    this.lastBoundaryDynamicsRequestMs = 0;
    this.lastBoundaryDynamicsRequestQuarter = -1;

    this.lastSnakeMessage = buildDefaultSnakeMessage();
    this.lastEatenMessage = buildDefaultEatenMessage();
    this.lastSnakeAtEaten = buildDefaultSnakeMessage();
    this.awaitingPostEatSnap = false;
    this.lastTacetMessage = buildTacetMessage(this.lastEatenMessage, null);
    this.tempoAutoEnabled = true;
    this.tempoControlIndex = getDefaultTempoIndex();
    this.lastSnakeTempoControlIndex = getDefaultTempoIndex();
    this.lastSnakeTempoBpm = getDefaultBpm();

    roomCounter++;
  }

}

function getRoomOfSnake(ws) {
  var room = null;
  rooms.forEach(function (element) {
    if (element.snakeWS === ws) {
      room = element;
    }
  });
  return room;
}

function getRoomOfClient(ws) {
  var room = null;
  rooms.forEach(function (element) {
    if (element.clients.includes(ws)) {
      room = element;
    }
  });
  return room;
}

function getRoomByID(id) {
  var room = null;
  rooms.forEach(function (element) {
    if (element.ID === id) {
      room = element;
    }
  });
  return room;
}

function removeClient(ws) {
  var room = getRoomOfClient(ws);
  if (room) {
    room.clients.splice(room.clients.indexOf(ws), 1);
    return room;
  }
  return null;
}

function getAllIDs() {
  var ids = [];
  rooms.forEach(function (element) {
    ids.push(element.ID);
  });
  return ids;
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;

  ws.on('close', () => {
    if (scoreClients.includes(ws)) {
      scoreClients.splice(scoreClients.indexOf(ws), 1);
      if (rooms.length > 0) {
        removeClient(ws);
      }
      console.log('at ' + new Date().toLocaleTimeString() +
        ' Score client DISCONNECTED IP: ' + ip);
      return;
    }

    var snakeRoom = getRoomOfSnake(ws);
    if (!snakeRoom) {
      return;
    }
    console.log('at ' + new Date().toLocaleTimeString() +
      ' Snake/tetris DISCONNECTED IP: ' + snakeRoom.snakeIP + ' ID: ' + snakeRoom.ID);
    rooms.splice(rooms.indexOf(snakeRoom), 1);
    scoreClients.forEach(function (element) {
      if (element && element.readyState === 1) {
        element.send('IDS ' + getAllIDs());
      }
    });
  });

  ws.on('message', function (data) {
    var message = typeof data === 'string' ? data : data.toString();

    if (message.startsWith('IAMSNAKE')) {
      var id = message.replace('IAMSNAKE ', '');
      var room = getRoomByID(Number(id));
      if (room) {
        room.snakeWS = ws;
        room.snakeIP = ip;
      } else {
        room = new Room(ws, ip);
        rooms.push(room);
      }
      ws.send('ACCEPTED ' + room.ID);

      scoreClients.forEach(function (element) {
        if (element && element.readyState === 1) {
          element.send('IDS ' + getAllIDs());
        }
      });

      console.log('at ' + new Date().toLocaleTimeString() +
        ' Snake/tetris host IP: ' + ip + ' ID: ' + room.ID);
      requestBoundaryDynamicsFromSnake(room, Date.now());
      return;
    }

    if (message === 'IAMSCORE') {
      scoreClients.push(ws);
      sendTempoTableToClient(ws);
      if (rooms.length > 0) {
        ws.send('IDS ' + getAllIDs());
      }
      console.log('at ' + new Date().toLocaleTimeString() +
        ' New score client added, now total: ' + scoreClients.length);
      return;
    }

    if (message.startsWith('JOIN')) {
      var idToJoin = Number(message.replace('JOIN ', ''));
      removeClient(ws);
      var joinRoom = getRoomByID(idToJoin);
      if (!joinRoom) {
        return;
      }

      joinRoom.clients.push(ws);
      if (ws.reportedStaffCount > 0) {
        joinRoom.staffCount = ws.reportedStaffCount;
      }

      sendTempoTableToClient(ws);
      sendRoomTempoControlToClient(ws, joinRoom);
      sendRoomStateToClient(ws, joinRoom, Date.now());
      sendRoomClockToClient(ws, joinRoom, Date.now());

      ws.send(buildInitialStateMessage(joinRoom.lastEatenMessage, joinRoom.lastSnakeAtEaten));
      if (joinRoom.lastTacetMessage) {
        ws.send(joinRoom.lastTacetMessage);
      }
      if (joinRoom.currentDynamicsMessage) {
        ws.send(joinRoom.currentDynamicsMessage);
      } else if (!joinRoom.pendingEatenInfo && !joinRoom.awaitingPostEatSnap) {
        requestBoundaryDynamicsFromSnake(joinRoom, Date.now());
      }
      return;
    }

    if (message === 'BACK') {
      removeClient(ws);
      return;
    }

    if (scoreClients.includes(ws) && message.startsWith('SYNC ')) {
      var clientSentAt = Number(message.replace('SYNC ', ''));
      if (Number.isFinite(clientSentAt)) {
        ws.send('SYNC ' + clientSentAt + ' ' + Date.now());
      }
      var syncRoom = getRoomOfClient(ws);
      if (syncRoom) {
        sendRoomTempoControlToClient(ws, syncRoom);
        sendRoomStateToClient(ws, syncRoom, Date.now());
        sendRoomClockToClient(ws, syncRoom, Date.now());
      }
      return;
    }

    if (scoreClients.includes(ws) && message.startsWith('STAFFCOUNT ')) {
      var reportedCount = Number(message.replace('STAFFCOUNT ', ''));
      if (Number.isFinite(reportedCount) && reportedCount > 0) {
        ws.reportedStaffCount = Math.round(reportedCount);
        var roomForCount = getRoomOfClient(ws);
        if (roomForCount) {
          roomForCount.staffCount = ws.reportedStaffCount;
        }
      }
      return;
    }

    if (scoreClients.includes(ws)) {
      var roomFromScore = getRoomOfClient(ws);
      if (!roomFromScore) {
        return;
      }

      if (message.startsWith('ROOM_TEMPO_CONTROL ')) {
        var tempoControl = parseClientTempoControlMessage(message);
        if (!tempoControl) {
          return;
        }
        roomFromScore.tempoAutoEnabled = tempoControl.autoEnabled;
        roomFromScore.tempoControlIndex = tempoControl.tempoIndex;
        if (roomFromScore.tempoAutoEnabled) {
          if (Number.isFinite(Number(roomFromScore.lastSnakeTempoBpm))) {
            roomFromScore.transport.pendingTempoBpm = clampTransportBpm(roomFromScore.lastSnakeTempoBpm);
          } else {
            roomFromScore.transport.pendingTempoBpm = Number.NaN;
          }
        } else {
          roomFromScore.transport.pendingTempoBpm = tempoIndexToBpm(roomFromScore.tempoControlIndex);
        }
        markStateChanged(roomFromScore);
        broadcastRoomTempoControl(roomFromScore);
        broadcastRoomState(roomFromScore, Date.now());
        return;
      }

      if (!roomFromScore.snakeWS || roomFromScore.snakeWS.readyState !== 1) {
        return;
      }
      roomFromScore.snakeWS.send(message);
      return;
    }

    // Snake sends message to clients.
    var roomFromSnake = getRoomOfSnake(ws);
    if (!roomFromSnake) {
      return;
    }

    var now = Date.now();

    var pauseControl = resolveRunningControlFromMessage(message);
    if (pauseControl !== null) {
      roomFromSnake.snakePaused = !pauseControl;
      markStateChanged(roomFromSnake);
      broadcastRoomState(roomFromSnake, now);
      return;
    }

    if (message.startsWith('tempo')) {
      console.log('ROOM ' + roomFromSnake.ID + ' received tempo message: ' + message);
      var tempoParts = message.trim().split(/\s+/);
      if (tempoParts.length > 1) {
        var tempoIndex = tempoControlToIndex(tempoParts[1]);
        var bpm = tempoControlToBpm(tempoParts[1]);
        if (Number.isFinite(tempoIndex) && Number.isFinite(bpm)) {
          roomFromSnake.lastSnakeTempoControlIndex = tempoIndex;
          roomFromSnake.lastSnakeTempoBpm = bpm;
          if (roomFromSnake.tempoAutoEnabled) {
            roomFromSnake.transport.pendingTempoBpm = bpm;
            markStateChanged(roomFromSnake);
            broadcastRoomState(roomFromSnake, now);
            if (roomFromSnake.snakePaused) {
              console.log('ROOM ' + roomFromSnake.ID + ' tempo message while paused: queued for boundary -> ' + bpm.toFixed(3));
            }
          } else {
            console.log(
              'ROOM ' + roomFromSnake.ID +
              ' tempo message ignored for apply (manual mode). stored bin=' + (tempoIndex + 1) +
              ' bpm=' + bpm.toFixed(3)
            );
          }
        }
      }
      return;
    }

    if (message.startsWith('dynam')) {
      var hasNoDynamicsSnapshotYet = !roomFromSnake.currentDynamicsMessage || roomFromSnake.currentDynamicsVersion <= 0;
      if (roomFromSnake.awaitingBoundaryDynamics || hasNoDynamicsSnapshotYet) {
        applyDynamicsSnapshot(roomFromSnake, message, now);
        if (roomFromSnake.snakePaused) {
          console.log('ROOM ' + roomFromSnake.ID + ' dynamics snapshot applied while paused');
        }
      }
      return;
    }

    if (roomFromSnake.snakePaused) {
      console.log('ROOM ' + roomFromSnake.ID + ' paused but got message: ' + message);
      return;
    }

    if (message.startsWith('eaten ')) {
      roomFromSnake.lastEatenMessage = message;
      roomFromSnake.pendingEatenInfo = parseEatenInfo(message);
      if (roomFromSnake.pendingEatenInfo) {
        roomFromSnake.pendingEatenInfo.phraseSeq = roomFromSnake.nextPhraseSeq;
        roomFromSnake.nextPhraseSeq += 1;
      }
      roomFromSnake.awaitingPostEatSnap = true;

      var tacetMessage = buildTacetMessage(message, roomFromSnake.staffCount);
      if (tacetMessage !== null) {
        roomFromSnake.lastTacetMessage = tacetMessage;
      }

      broadcastToRoomClients(roomFromSnake, message);
      if (tacetMessage !== null) {
        broadcastToRoomClients(roomFromSnake, tacetMessage);
      }
      return;
    }

    if (message.startsWith('snake ')) {
      roomFromSnake.lastSnakeMessage = message;
      if (roomFromSnake.awaitingPostEatSnap) {
        roomFromSnake.lastSnakeAtEaten = message;
        roomFromSnake.awaitingPostEatSnap = false;
      }

      var parsedPhrase = parseSnakePhrase(message);
      if (!roomFromSnake.hasCandidate && (!Number.isFinite(roomFromSnake.currentNumQuarters) || roomFromSnake.currentNumQuarters <= 0) && parsedPhrase) {
        roomFromSnake.currentFromQuarter = parsedPhrase.fromQuarter;
        roomFromSnake.currentNumQuarters = parsedPhrase.numQuarters;
        roomFromSnake.transport.beatsPerPhrase = Math.max(1, Math.floor(Number(parsedPhrase.numQuarters) || 1));
        markStateChanged(roomFromSnake);
        broadcastRoomState(roomFromSnake, now);
      }

      if (roomFromSnake.pendingEatenInfo && parsedPhrase) {
        roomFromSnake.candidateFromQuarter = parsedPhrase.fromQuarter;
        roomFromSnake.candidateNumQuarters = parsedPhrase.numQuarters;
        roomFromSnake.candidateTranspose = roomFromSnake.pendingEatenInfo.transpose;
        roomFromSnake.candidatePhraseSeq = Number.isFinite(Number(roomFromSnake.pendingEatenInfo.phraseSeq))
          ? Math.floor(Number(roomFromSnake.pendingEatenInfo.phraseSeq))
          : -1;
        roomFromSnake.pendingEatenInfo = null;
        roomFromSnake.hasCandidate = true;
        markStateChanged(roomFromSnake);
        broadcastRoomState(roomFromSnake, now);
      }

      broadcastToRoomClients(roomFromSnake, message);
      return;
    }

    // Forward other non-timing snake payloads as-is.
    broadcastToRoomClients(roomFromSnake, message);
  });
});

setInterval(function () {
  var now = Date.now();
  rooms.forEach(function (room) {
    advanceRoomClock(room, now);
  });
}, TRANSPORT_TICK_MS);
