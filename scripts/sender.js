'use strict';

var utils = require('./utils');

var Sender = function (db) {
  this._db = db;
  this._sending = false;
  this._lastSent = new Date();
};

Sender.SEND_EVERY_MS = 1000;

Sender.prototype._doSend = function () {
  return this._db._findAndEmitChanges();
};

Sender.prototype._sendLoop = function () {
  var self = this;

  if (self._lastSent.getTime() > self._requested.getTime()) { // nothing more to send?
    self._sending = false;
  } else {

    // Sleep by 1 ms so that _lastSent is != _requested for the first request
    return utils.timeout(1).then(function () {
      self._lastSent = new Date();
      return self._doSend();
    }).then(function () {
      //   return utils.timeout(Sender.SEND_EVERY_MS);
      // }).then(function () {
      //   self._sendLoop();

      // TODO: is it better to use setTimout below than another promise as it is won't cause a stack
      // overflow?
      setTimeout(function () {
        self._sendLoop();
      }, Sender.SEND_EVERY_MS);

      return null; // prevent runaway promise warnings
    });
  }
};

Sender.prototype.send = function () {
  // - Kick off a send process if not already sending. If already sending then set timestamp
  // - When send process completes, check timestamp and determine if need to send again
  this._requested = new Date();

  if (!this._sending) {
    this._sending = true;
    this._sendLoop();
  }
};

module.exports = Sender;
