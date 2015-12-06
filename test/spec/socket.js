'use strict';

var Socket = require('../../scripts/socket');

describe('socket', function () {

  var socket = new Socket();

  var mockSocket = {
    emit: function () {},
    on: function () {},
    disconnect: function () {}
  };

  var mockIO = function () {
    socket._io = {
      connect: function () {
        return mockSocket;
      }
    };
  };

  mockIO();

  it('should connect', function () {
    socket.connect();
  });

  it('should emit', function () {
    socket.emit();
  });

  it('should on', function () {
    socket.on();
  });

  it('should disconnect', function () {
    socket.disconnect();
  });

});
