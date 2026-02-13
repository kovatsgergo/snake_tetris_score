'use strict';

const express = require('express');
const {
  Server
} = require('ws');

const PORT = process.env.PORT || 3000;
//const INDEX = '/index.html';

const server = express()
  .use('/', express.static(__dirname + '/'))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({
  server
});
var scoreClients = [];
//var snakeClient = null;
//var snakeClientIP = null;
var roomCounter = 0;
var rooms = [];

class Room {
  constructor(ws, snakeIP) {
    this.snakeWS = ws;
    this.snakeIP = snakeIP;
    this.clients = [];
    this.ID = roomCounter + 1;
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
          ' Snake/tetris DISCONNECTED IP: ' + room.snakeClientIP + " ID: " + room.ID);
        var room = getRoomOfSnake(ws);
        rooms.splice(rooms.indexOf(room), 1);
        scoreClients.forEach(element =>
          element.send('IDS ' + getAllIDs()));
      }
    }
  });

  ws.on('message', function (data) {
    //console.log(ws === snakeClient);
    //console.log(data);
    if (data.startsWith('IAMSNAKE')) {
      //SNAKE IS TRYING TO LOG IN
      var id = data.replace('IAMSNAKE ', '');
      var room = getRoomByID(Number(id));
      if (room) {
        room.snakeWS = ws;
        room.snakeIP = ip;
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

    } else if (data === 'IAMSCORE') {
      //SCORE IS TRYING TO LOG IN
      scoreClients.push(ws);
      if (rooms.length > 0)
        ws.send('IDS ' + getAllIDs());
      console.log('at ' + new Date().toLocaleTimeString() +
        ' New score client added, now total: ' + scoreClients.length);
    } else if (data.startsWith('JOIN')) {
      //SCORE JOINS A ROOM
      var id = Number(data.replace('JOIN ', ''));
      if (rooms.length > 0) {
        removeClient(ws);
        var room = getRoomByID(id)
        room.clients.push(ws);
        room.update();
      }
    } else if (data === 'BACK') {
      //SCORE EXITS ROOM
      if (rooms.length > 0) {
        removeClient(ws);
      }
    } else if (scoreClients.includes(ws)) {
      //SCORE SENDS MESSAGE TO SNAKE
      if (rooms.length > 0) {
        var room = getRoomOfClient(ws)
        if (room)
          room.snakeWS.send(data);
      }
    } else {
      //SNAKE SENDS MESSAGE TO CLIENTS
      console.log(data);
      if (rooms.length > 0) {
        var clients = getRoomOfSnake(ws).clients;
        if (clients.length > 0)
          clients.forEach(element => {
            element.send(data);
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