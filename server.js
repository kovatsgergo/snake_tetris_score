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
var snakeClient = null;
var snakeClientIP = null;

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  //ws.client.send('WHOAREYOU');
  //console.log(ws);

  ws.on('close', () => {
    console.log('disconnection');
    if (ws === snakeClient) {
      snakeClient = null;
      snakeClientIP = null;
      console.log('at ' + new Date().toLocaleTimeString() +
        ' Snake/tetris DISCONNECTED IP: ' + ip);
      scoreClients.forEach(element =>
        element.send('SNAKE-TETRIS disconnected '));
    }
    else if (scoreClients.includes(ws)) {
      scoreClients.splice(scoreClients.indexOf(ws), 1);
      console.log('at ' + new Date().toLocaleTimeString() +
        ' Score client DISCONNECTED IP: ' + ip);
    }
  });

  ws.on('message', function (data) {
    //console.log(ws === snakeClient);
    //console.log(ws);
    if (data === 'IAMSNAKE') {
      if (snakeClient == null) {
        snakeClient = ws;
        snakeClientIP = ip;
        ws.send('ACCEPTED');
        scoreClients.forEach(element =>
          element.send('SNAKE-TETRIS at ' + ip));
        console.log('at ' + new Date().toLocaleTimeString() +
          ' Snake/tetris host IP: ' + ip);
      } else {
        ws.send('BUSY');
        console.log('at ' + new Date().toLocaleTimeString() +
          ' Snake/tetris host REFUSED: ' + ip);
      }
    } else if (data === 'IAMSCORE') {
      scoreClients.push(ws);
      if (snakeClient != null)
        ws.send('SNAKE-TETRIS at ' + snakeClientIP);
      console.log('at ' + new Date().toLocaleTimeString() +
        ' New score client added, now total: ' + scoreClients.length);
    } else if (ws === snakeClient && scoreClients.length > 0) {
      scoreClients.forEach(element => element.send(data));
    } else if (scoreClients.includes(ws) && snakeClient != null) {
      snakeClient.send(data);
    }
  });
});

// setInterval(() => {
//   wss.clients.forEach((client) => {
//     client.send(new Date().toTimeString());
//   });
// }, 1000);