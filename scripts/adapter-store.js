'use strict';

var MemAdapter = require('../orm/nosql/adapters/mem/adapter');

/**
 * This class provides us with a global way of keeping the store selector abstracted so that we
 * don't have to include browser specific implementations, e.g. IndexedDB, in our node tests and
 * test coverage.
 *
 * It also allows us to keep a global instance of the adapter so that multiple clients within the
 * same app can share the same adapters, which allows us to synchronize reads/writes from/to the
 * adapters.
 */
var AdapterStore = function () {};

// TODO: test!
/* istanbul ignore next */
AdapterStore.prototype.newAdapter = function () {
  return new MemAdapter();
};

AdapterStore.prototype.getAdapter = function () {
  if (!this._adapter) {
    this._adapter = this.newAdapter();
  }
  return this._adapter;
};

module.exports = new AdapterStore();
