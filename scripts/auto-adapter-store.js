'use strict';

var IDBAdapter = require('deltadb-orm-nosql/scripts/adapters/indexed-db'),
  MemAdapter = require('deltadb-orm-nosql/scripts/adapters/mem'),
  idbUtils = require('deltadb-orm-nosql/scripts/adapters/indexed-db/utils'),
  adapterStore = require('./adapter-store');

// Create a store based on the availibility of whether we are using a browser or not
adapterStore.newAdapter = function () {
  // TODO: test
  /* istanbul ignore next */
  if (global.window && idbUtils.indexedDB()) { // in browser and have IndexedDB?
    return new IDBAdapter();
  } else {
    return new MemAdapter();
  }
};
