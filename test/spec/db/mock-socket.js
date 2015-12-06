'use strict';

var inherits = require('inherits'),
  EventEmitter = require('events').EventEmitter,
  clientUtils = require('../../../scripts/utils'),
  DBMissingError = require('deltadb-common-utils/scripts/errors/db-missing-error');

var MockSocket = function () {
  this._dbs = {};
  this._dbs[clientUtils.SYSTEM_DB_NAME] = true; // system should always be present
};

inherits(MockSocket, EventEmitter);

MockSocket.prototype.connect = function ( /* url */ ) {
  var self = this;
  setTimeout(function () { // trigger on next tick to allow time for binding
    self.emit('connect');
  });
};

MockSocket.prototype._processInit = function (msg) {
  if (this._dbs[msg.db]) { // db exists?
    this.emit('init-done');
  } else { // db missing
    this.emit('delta-error', new DBMissingError(msg.db + ' missing'));
  }
};

MockSocket.prototype._processDBAction = function (change) {
  var val = JSON.parse(change.val);

  switch (val.action) {
  case clientUtils.ACTION_ADD:

    break;

  case clientUtils.ACTION_REMOVE:

    break;
  }
};

MockSocket.prototype._processAction = function (change) {
  switch (change.col) {
  case clientUtils.DB_COLLECTION_NAME:
    this._processDBAction(change);
    break;
  }
};

MockSocket.prototype._processChange = function (change) {
  switch (change.name) {
  case clientUtils.ATTR_NAME_ACTION:
    this._processAction(change);
    break;
  }
};

MockSocket.prototype._processChanges = function (msg) {
  var self = this;
  msg.changes.forEach(function (change) {
    self._processChange(change);
    change.re = (new Date()).toISOString(); // simulate recording
  });

  // Simulate recording
  this.emit('changes', msg, true);
};

MockSocket.prototype.emit = function (event, msg, fromServer) {

  if (!fromServer) { // coming from client?
    switch (event) {
    case 'init':
      this._processInit(msg);
      break;

    case 'changes':
      this._processChanges(msg);
      break;
    }
  }

  return EventEmitter.prototype.emit.apply(this, arguments);
};

MockSocket.prototype.on = function ( /* event, callback */ ) {
  return EventEmitter.prototype.on.apply(this, arguments);
};

MockSocket.prototype.disconnect = function () {
  // TODO: needed?
  this.emit('disconnect');
};

module.exports = MockSocket;
