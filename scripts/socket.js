'use strict';

var io = require('socket.io-client');

/**
 * Abstract the socket interface for testing and the ability to swap out socket libs
 */
var Socket = function () {
  this._io = io; // for mocking
};

Socket.prototype.connect = function (url) {
  this._socket = this._io.connect(url, {
    'force new connection': true
  }); // same client, multiple connections for testing
};

Socket.prototype.emit = function (event, msg) {
  this._socket.emit(event, msg);
};

Socket.prototype.on = function (event, callback) {
  this._socket.on(event, callback);
};

Socket.prototype.disconnect = function () {
  this._socket.disconnect();
};

module.exports = Socket;
