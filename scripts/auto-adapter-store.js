'use strict';

var IDBAdapter = require('../orm/nosql/adapters/indexeddb/adapter'),
  MemAdapter = require('../orm/nosql/adapters/mem/adapter'),
  idbUtils = require('../orm/nosql/adapters/indexeddb/utils'),
  adapterStore = require('./adapter-store');

// Create a store based on the availibility of whether we are using a browser or not
adapterStore.newAdapter = function () {
  if (global.window && idbUtils.indexedDB()) { // in browser and have IndexedDB?
    return new IDBAdapter();
  } else {
    return new MemAdapter();
  }
};
