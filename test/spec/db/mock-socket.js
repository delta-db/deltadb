'use strict';

var inherits = require('inherits'),
  EventEmitter = require('events').EventEmitter;

var MockSocket = function () {};

inherits(MockSocket, EventEmitter);

MockSocket.prototype.connect = function ( /* url */ ) {
  var self = this;
  setTimeout(function () { // trigger on next tick to allow time for binding
    self.emit('connect');
  });
};

MockSocket.prototype.emit = function (event/* , msg */) {

  switch (event) {
  case 'init':
    this.emit('init-done');
    break;
  }

  return EventEmitter.prototype.emit.apply(this, arguments);
};

MockSocket.prototype.on = function (/* event, callback */) {
  return EventEmitter.prototype.on.apply(this, arguments);
};

MockSocket.prototype.disconnect = function () {
  // TODO: needed?
  this.emit('disconnect');
};

module.exports = MockSocket;
