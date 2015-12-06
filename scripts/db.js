'use strict';

// TODO: later, db should be passed in a constructor so that it doesn't have to be passed to sync??

// TODO: move events to deltadb-orm-nosql layer?

var inherits = require('inherits'),
  Promise = require('bluebird'),
  utils = require('deltadb-common-utils'),
  MemDB = require('deltadb-orm-nosql/scripts/adapters/mem/db'),
  Doc = require('./doc'),
  Collection = require('./collection'),
  clientUtils = require('./utils'),
  Sender = require('./sender'),
  log = require('./log'),
  config = require('./config'),
  Socket = require('./socket');

// TODO: shouldn't password be a char array?
var DB = function (name, adapter, url, localOnly, noFilters, username, password, hashedPassword) {
  this._id = Math.floor(Math.random() * 10000000); // used to debug multiple connections

  name = clientUtils.escapeDBName(name);

  MemDB.apply(this, arguments); // apply parent constructor

  this._socket = new DB._SocketClass();

  this._batchSize = DB.DEFAULT_BATCH_SIZE;
  this._cols = {};
  this._retryAfterMSecs = 180000;
  this._recorded = false;
  this._sender = new Sender(this);
  this._url = url ? url : config.URL;
  this._username = username;
  this._password = password;
  this._hashedPassword = hashedPassword;

  this._prepInitDone();

  this._initStoreLoaded();

  this._storesImported = false;

  this._noFilters = noFilters;

  this._localOnly = localOnly;

  if (!localOnly) {
    // This is registered immediately so that do not listen for a change after a change has already
    this._registerSenderListener();

    this._connectWhenReady();
  }

};

inherits(DB, MemDB);

// Used for mocking the socket
DB._SocketClass = Socket;

DB.PROPS_COL_NAME = '$props';

DB.PROPS_DOC_ID = 'props';

// Use a version # to allow for patching of the store between versions when the schema changes
DB.VERSION = 1;

// The max number of deltas to send in a batch
DB.DEFAULT_BATCH_SIZE = 100;

DB.prototype._prepInitDone = function () {
  // This promise ensures that the we have already received init-done from the server
  this._initDone = utils.once(this, 'init-done');
};

DB.prototype._initStoreLoaded = function () {
  // This promise ensures that the store is ready before we use it.
  this._storeLoaded = utils.once(this, 'load'); // TODO: are _storeLoaded and _loaded both needed?
};

// TODO: can this be cleaned up? Do we really need _storeLoaded, _loaded and _ready?
DB.prototype._ready = function () {
  var self = this;
  return self._storeLoaded.then(function () {
    return self._loaded;
  });
};

DB.prototype._import = function (store) {
  var self = this;

  self._store = store;

  // Make sure the store is ready, e.g. opened, before init
  return self._store._loaded.then(function () {
    return self._initStore();
  });
};

/**
 * Flows:
 * - Data loaded from store, e.g. from IndexedDB. After which the 'load' event is emitted
 * - When registering a doc:
 *   - Wait for until DB has finished loading store so that we don't create a duplicate
 *   - Get or create col store
 *   - Get or create doc store
 */
DB.prototype._initStore = function () {
  var self = this,
    promises = [],
    loadingProps = false;

  self._store.all(function (colStore) {
    if (colStore._name === DB.PROPS_COL_NAME) {
      loadingProps = true;
      promises.push(self._initProps(colStore));
    } else {
      var col = self._col(colStore._name);
      col._import(colStore);
      promises.push(col._loaded);
    }
  });

  // All the stores have been imported
  self._storesImported = true;

  return Promise.all(promises).then(function () {
    if (!loadingProps) { // no props? nothing in store
      return self._initProps();
    }
  }).then(function () {
    self.emit('load');
    return null; // prevent runaway promise warnings
  });
};

DB.prototype._initProps = function (colStore) {
  var self = this;

  if (colStore) { // reloading?
    self._propCol = colStore;
  } else {
    self._propCol = self._store.col(DB.PROPS_COL_NAME);
  }

  return self._propCol.get(DB.PROPS_DOC_ID).then(function (doc) {
    if (doc) { // found?
      self._props = doc;
    } else {
      var props = {};
      props[self._store._idName] = DB.PROPS_DOC_ID;
      self._props = self._propCol.doc(props);
      return self._props.set({
        since: null,
        version: DB.VERSION
      });
    }
  });
};

// TODO: make sure user-defined colName doesn't start with $
// TODO: make .col() not be promise any more? Works for indexedb and mongo adapters?
DB.prototype._col = function (name) {
  if (this._cols[name]) {
    return this._cols[name];
  } else {
    var col = new Collection(name, this);
    this._cols[name] = col;
    this._emitColCreate(col);

    return col;
  }
};

DB.prototype.col = function (name) {
  return this._col(name, true);
};

DB.prototype._emitColCreate = function (col) {
  this.emit('col:create', col);
  this._adapter._emit('col:create', col); // also bubble up to adapter layer
};

DB.prototype._localChanges = function (retryAfter, returnSent, limit) {
  var chain = Promise.resolve(),
    changes = [],
    more = false;

  // Use a container so that other methods can modify the value
  var nContainer = {
    n: 0
  };

  this.all(function (col) {
    // We need to process changes sequentially so that we can reliably limit the total number of
    // deltas sent to the server
    chain = chain.then(function () {
      // Have we processed the max batch size? Then stop
      if (!limit || nContainer.n < limit) {
        return col._localChanges(retryAfter, returnSent, limit, nContainer).then(function (
          _changes) {
          changes = changes.concat(_changes.changes);

          // More changes that we won't fit in this batch?
          if (_changes.more) {
            more = true;
          }
        });
      } else {
        // More changes that we won't fit in this batch? We need to set more here as we may not have
        // reached our limit within a single col, but we do when we consider all the cols in this
        // db.
        more = true;
      }
    });
  });

  return chain.then(function () {
    return {
      changes: changes,
      more: more
    };
  });
};

DB.prototype._setChange = function (change) {
  var col = this.col(change.col);
  return col._setChange(change);
};

// Process changes sequentially or else duplicate collections can be created
DB.prototype._setChanges = function (changes) {
  var self = this,
    chain = Promise.resolve();

  if (!changes) {
    return chain;
  }

  changes.forEach(function (change) {
    chain = chain.then(function () {
      return self._setChange(change);
    });
  });

  return chain;
};

// TODO: rename to _sync as shouldn't be called by user
DB.prototype.sync = function (part, quorum) {
  var self = this,
    newSince = null;
  return self._localChanges(self._retryAfterMSecs).then(function (changes) {
    return part.queue(changes.changes, quorum);
  }).then(function () {
    newSince = new Date();
    return self._loaded; // ensure props have been loaded/created first
  }).then(function () {
    return part.changes(self._props.get('since'));
  }).then(function (changes) {
    return self._setChanges(changes);
  }).then(function () {
    return self._props.set({
      since: newSince
    });
  });
};

DB.prototype._emit = function () { // event, arg1, ... argN
  var args = utils.toArgsArray(arguments);
  this.emit.apply(this, args);
  this._adapter._emit.apply(this._adapter, args); // also bubble up to adapter layer

  if (!this._recorded && args[0] === 'attr:record') { // not recorded yet?
    this.emit('db:record', this);
    this._adapter._emit('db:record', this); // also bubble up to adapter layer
    this._recorded = true;
  }
};

DB.prototype.policy = function (colName, policy) {
  // Find/create collection and set policy for new doc
  var col = this.col(colName);
  return col.policy(policy);
};

// TODO: shouldn't the password be a byte/char array so that passwords aren't stored in memory in
// their entirety? See
// http://stackoverflow.com/questions/28511970/javascript-security-force-deletion-of-sensitive-data
DB.prototype.createUser = function (userUUID, username, password, status) {
  var col = this.col(Doc._userName);
  return col._createUser(userUUID, username, password, status);
};

// TODO: shouldn't the password be a byte/char array so that passwords aren't stored in memory in
// their entirety? See
// http://stackoverflow.com/questions/28511970/javascript-security-force-deletion-of-sensitive-data
DB.prototype.updateUser = function (userUUID, username, password, status) {
  return this.createUser(userUUID, username, password, status);
};

// TODO: better to implement "Generator" doc like create/destroy DB?
DB.prototype._resolveAfterRoleCreated = function (userUUID, roleName, originatingDoc, ts) {
  return new Promise(function (resolve) {
    // When adding a user to a role, the delta is id-less and so we cannot use an id to reconcile
    // the local doc. Instead we listen for a new doc on the parent collection and then delete the
    // local doc that was used to originate the delta so that we don't attempt to add the user to
    // the role again.

    var listener = function (doc) {
      var data = doc.get();
      // The same user-role mapping could have been created before so we need to check the timestamp

      // TODO: test
      /* istanbul ignore next */
      if (data[clientUtils.ATTR_NAME_ROLE] &&
        data[clientUtils.ATTR_NAME_ROLE].action === clientUtils.ACTION_ADD &&
        data[clientUtils.ATTR_NAME_ROLE].userUUID === userUUID &&
        data[clientUtils.ATTR_NAME_ROLE].roleName === roleName &&
        (!doc._dat.recordedAt || doc._dat.recordedAt.getTime() >= ts.getTime())) {

        // Remove listener so that we don't listen for other docs
        originatingDoc._col.removeListener('doc:record', listener);

        resolve(originatingDoc._destroyLocally());
      }
    };

    originatingDoc._col.on('doc:record', listener);
  });
};

// TODO: better to implement "Generator" doc like create/destroy DB?
DB.prototype.addRole = function (userUUID, roleName) {
  var self = this,
    ts = new Date(),
    colName = clientUtils.NAME_PRE_USER_ROLES + userUUID,
    col = self.col(colName);
  return col._addRole(userUUID, roleName).then(function (doc) {
    return self._resolveAfterRoleCreated(userUUID, roleName, doc, ts);
  });
};

// TODO: better to implement "Generator" doc like create/destroy DB?
DB.prototype._resolveAfterRoleDestroyed = function (userUUID, roleName, originatingDoc, ts) {
  return new Promise(function (resolve) {
    // When removing a user's role, the delta is id-less and so we cannot use an id to reconcile
    // the local doc. Instead we listen for a new doc on the parent collection and then delete the
    // local doc that was used to originate the delta so that we don't attempt to remove the user's
    // role again.

    var listener = function (doc) {
      var data = doc.get();
      // The same user-role mapping could have been destroyed before so we need to check the
      // timestamp

      // TODO: test
      /* istanbul ignore next */
      if (data[clientUtils.ATTR_NAME_ROLE] &&
        data[clientUtils.ATTR_NAME_ROLE].action === clientUtils.ACTION_REMOVE &&
        data[clientUtils.ATTR_NAME_ROLE].userUUID === userUUID &&
        data[clientUtils.ATTR_NAME_ROLE].roleName === roleName &&
        (!doc._dat.recordedAt || doc._dat.recordedAt.getTime() >= ts.getTime())) {

        // Remove listener so that we don't listen for other docs
        originatingDoc._col.removeListener('doc:record', listener);

        resolve(originatingDoc._destroyLocally());
      }
    };

    originatingDoc._col.on('doc:record', listener);
  });
};

// TODO: better to implement "Generator" doc like create/destroy DB?
DB.prototype.removeRole = function (userUUID, roleName) {
  var self = this,
    ts = new Date(),
    colName = clientUtils.NAME_PRE_USER_ROLES + userUUID,
    col = self.col(colName);
  return col._removeRole(userUUID, roleName).then(function (doc) {
    return self._resolveAfterRoleDestroyed(userUUID, roleName, doc, ts);
  });
};

DB.prototype._createDatabase = function (dbName) {
  var colName = clientUtils.DB_COLLECTION_NAME;
  var col = this.col(colName);
  return col._createDatabase(dbName);
};

DB.prototype._destroyDatabase = function (dbName) {
  var colName = clientUtils.DB_COLLECTION_NAME;
  var col = this.col(colName);
  return col._destroyDatabase(dbName);
};

DB.prototype.destroy = function (keepRemote, keepLocal) {
  var self = this,
    promise = null;

  if (keepRemote || self._localOnly || self._name === clientUtils.SYSTEM_DB_NAME) {
    promise = Promise.resolve();
  } else {
    promise = self._destroyDatabaseViaSystem(self._name);
  }

  return promise.then(function () {
    if (!self._localOnly) {
      // Stop listening to the server entirely
      return self._disconnect();
    }
  }).then(function () {
    if (!keepLocal) {
      return self._store.destroy();
    }
  }).then(function () {
    // Is this DB not a system DB and does it have an associated system DB?
    if (self._name !== clientUtils.SYSTEM_DB_NAME && self._sysDB) {
      // Also destroy the assoicated system DB. Always keep the remote instance
      return self._systemDB().destroy(true, keepLocal);
    }
  }).then(function () {
    return self._adapter._unregister(self._name);
  });
};

DB.prototype._emitInitMsg = function () {
  return {
    db: this._name,
    since: this._props.get('since'),
    filter: this._noFilters ? false : true,
    username: this._username,
    password: this._password,
    hashed: this._hashedPassword
  };
};

DB.prototype._emitInit = function () {
  var self = this;
  return self._ready().then(function () { // ensure props have been loaded/created first
    var msg = self._emitInitMsg();
    log.info(self._id + ' sending init ' + JSON.stringify(msg));
    self._socket.emit('init', msg);
    return null; // prevent runaway promise warnings
  });
};

DB.prototype._emitChanges = function (changes) {
  var msg = {
    changes: changes
  };
  log.info(this._id + ' sending ' + JSON.stringify(msg));
  this._socket.emit('changes', msg);
};

DB.prototype._findAndEmitBatchOfChanges = function () {
  // If we happen to disconnect when reading _localChanges then we'll rely on the retry to send
  // the deltas later
  var self = this;
  return self._localChanges(self._retryAfterMSecs, null, self._batchSize).then(function (changes) {
    // The length could be zero if there is a race condition where two back-to-back changes result
    // in the first change emitting all the changes with a single call to _localChanges.
    if (changes.changes && changes.changes.length > 0) {
      self._emitChanges(changes.changes);
    }

    return changes.more;
  });
};

DB.prototype._findAndEmitAllChangesInBatches = function () {
  // We have to sequentially find the changes so that we can reliably limit their number
  var self = this;
  return self._findAndEmitBatchOfChanges().then(function (more) {
    if (more) { // more changes?
      return self._findAndEmitAllChangesInBatches();
    }
  });
};

DB.prototype._findAndEmitChanges = function () {
  // TODO: keep sync and this fn so that can test w/o socket, right? If so, then better way to reuse
  // code?
  var self = this;

  // If we aren't connected then wait for reconnect to send changes during init.
  if (!self._connected) {
    return Promise.resolve();
  }

  return self._ready().then(function () { // ensure props have been loaded/created first
    return self._findAndEmitAllChangesInBatches();
  });

};

DB.prototype._processChanges = function (msg) {
  var self = this;
  log.info(self._id + ' received ' + JSON.stringify(msg));
  return self._ready().then(function () { // ensure props have been loaded/created first
    return self._setChanges(msg.changes); // Process the server's changes
  }).then(function () {
    return self._props.set({ // Update since
      since: msg.since
    });
  });
};

DB.prototype._registerChangesListener = function () {
  var self = this;
  self._socket.on('changes', function (msg) {
    self._processChanges(msg);
  });
};

DB.prototype._registerSenderListener = function () {
  var self = this;
  self.on('change', function () {
    // This is registered immediately so that we don't listen for a change after a change has
    // already been made; therefore, we need to make sure the _initDone promise has resolved first.
    self._initDone.then(function () {
      self._sender.send();
      return null; // prevent runaway promise warnings
    });
  });
};

DB.prototype._registerDisconnectListener = function () {
  var self = this;
  self._socket.on('disconnect', function () {
    log.info(self._id + ' server disconnected');
    self._connected = false;
    self.emit('disconnect');
  });
};

DB.prototype._createDatabaseViaSystem = function (dbName) {
  return this._systemDB()._createDatabase(dbName).then(function (doc) {
    return utils.once(doc, 'doc:record');
  });
};

DB.prototype._destroyDatabaseViaSystem = function (dbName) {
  return this._systemDB()._destroyDatabase(dbName).then(function (doc) {
    return utils.once(doc, 'doc:record');
  });
};

DB.prototype._createDatabaseAndInit = function () {
  var self = this;
  return self._createDatabaseViaSystem(self._name).then(function () {
    self._init();
    return null; // prevent runaway promise warning
  });
};

DB.prototype._onDeltaError = function (err) {
  log.warning(this._id + ' err=' + err.message);

  if (err.name === 'DBMissingError') {
    log.info(this._id + ' creating DB ' + this._name);
    this._createDatabaseAndInit();
  } else {
    this.emit('error', err);
  }
};

DB.prototype._registerDeltaErrorListener = function () {
  var self = this;
  self._socket.on('delta-error', function (err) {
    self._onDeltaError(err);
  });
};

DB.prototype._registerInitDoneListener = function () {
  var self = this;

  // Server currently requires init-done before it will start listening to changes
  self._socket.on('init-done', function () {
    log.info(self._id + ' received init-done');
    self.emit('init-done'); // notify listeners
    self._sender.send();
  });
};

DB.prototype._init = function () {
  this._connected = true;
  this._emitInit();
};

DB.prototype._connect = function () {
  var self = this;

  self._socket.connect(self._url);

  self._registerDeltaErrorListener();

  self._registerDisconnectListener();

  self._registerChangesListener();

  self._registerInitDoneListener();

  self._socket.on('connect', function () {
    self._init();
  });

};

DB.prototype._disconnect = function () {
  var self = this;
  return self._ready().then(function () {
    var promise = utils.once(self, 'disconnect');
    self._socket.disconnect();
    return promise;
  });
};

DB.prototype._connectWhenReady = function () {
  var self = this;
  return self._storeLoaded.then(function () {
    return self._connect();
  });
};

/**
 * Each DB has an associated SystemDB as the DB needs to be able to point to any DB cluster and we
 * may have 2 DBs that point to different clusters so the same SystemDB could not be used.
 */
DB.prototype._systemDB = function () {
  if (!this._sysDB) {

    var opts = {
      db: clientUtils.SYSTEM_DB_NAME,
      alias: config.SYSTEM_DB_NAME_PREFIX + this._name,
      url: this._url,
      local: this._localOnly
    };

    this._sysDB = this._adapter.db(opts);
  }
  return this._sysDB;
};

module.exports = DB;
