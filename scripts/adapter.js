'use strict';

// TODO: should events be moved to nosql/common layer?

var inherits = require('inherits'),
  MemAdapter = require('../orm/nosql/adapters/mem/adapter'),
  DB = require('./db'),
  utils = require('../utils'),
  Promise = require('bluebird'),
  adapterStore = require('./adapter-store'),
  config = require('./config');

var Adapter = function (localOnly) {
  MemAdapter.apply(this, arguments); // apply parent constructor
  this._localOnly = localOnly;

  this._store = adapterStore.getAdapter();
};

// We inherit from MemAdapter so that we can have singular references in memory to items like Docs.
// This in turn allows us to emit and listen for events across different modules. The downside is
// that we end up with data duplicated in both local mem and the store.

inherits(Adapter, MemAdapter);

Adapter.prototype._emit = function () { // event, arg1, ... argN
  this.emit.apply(this, utils.toArgsArray(arguments));
};

Adapter.prototype.uuid = function () {
  return utils.uuid();
};

Adapter.prototype._dbStore = function (name, alias) {
  return this._store.db({
    db: (alias ? alias : config.DB_NAME_PREFIX + name)
  });
};

Adapter.prototype.db = function (opts) {
  var db = this._dbs[opts.db];
  if (db) { // exists?
    return db;
  } else {

    if (typeof opts.local === 'undefined') {
      opts.local = this._localOnly;
    }

    var dbStore = null;
    if (typeof opts.store === 'undefined') {
      dbStore = this._dbStore(opts.db, opts.alias);
    } else {
      dbStore = opts.store;
    }

    var filter = typeof opts.filter === 'undefined' ? true : opts.filter;

    db = new DB(opts.db, this, opts.url, opts.local, !filter, opts.username, opts.password);
    db._import(dbStore);
    this._dbs[opts.db] = db;
    this.emit('db:create', db);
    return db;
  }
};

Adapter.prototype._unregister = function (dbName) {
  delete this._dbs[dbName];
  return Promise.resolve();
};

module.exports = Adapter;
