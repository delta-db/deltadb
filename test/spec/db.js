'use strict';

var DB = require('../../scripts/db'),
  MemAdapter = require('deltadb-orm-nosql/scripts/adapters/mem'),
  Client = require('../../scripts/adapter'),
  commonUtils = require('deltadb-common-utils'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils'),
  clientUtils = require('../../scripts/utils'),
  Promise = require('bluebird');

describe('db', function () {

  var db = null,
    client = null;

  afterEach(function () {
    if (db) {
      return db.destroy(true);
    }
  });

  var createClientAndDB = function (opts) {
    client = new Client(true);

    var allOpts = {
      db: 'mydb'
    };

    if (opts) {
      allOpts = commonUtils.merge(allOpts, opts);
    }

    db = client.db(allOpts);
  };

  it('should reload properties', function () {
    var store = new MemAdapter();
    var client = new Client(true);

    var dbStore = store.db({
      db: 'mydb'
    });

    var propCol = dbStore.col(DB.PROPS_COL_NAME);

    var data = {};
    data[dbStore._idName] = DB.PROPS_DOC_ID;
    var doc = propCol.doc(data);
    return doc.set({
      since: null
    }).then(function () {
      client.db({
        db: 'mydb'
      });
      return null; // prevent runaway promise warning
    });
  });

  it('should reload db', function () {

    var client = new Client(true);

    // Wait for load after next tick to ensure there is no race condition. The following code was
    // failing when the DB store loading was triggered at the adapter layer.
    return commonUtils.timeout().then(function () {
      db = client.db({
        db: 'mydb',
        store: new MemAdapter().db('mydb')
      });
      return commonUtils.once(db, 'load');
    });
  });

  it('should throw delta errors', function () {
    createClientAndDB();

    return commonTestUtils.shouldNonPromiseThrow(function () {
      db._onDeltaError(new Error('my err'));
    }, new Error('my err'));
  });

  it('should find and emit when no changes', function () {
    // It is very hard to reliably guarantee the following race condition using e2e testing so we
    // test here
    var emitted = false;

    createClientAndDB();

    db._connected = true; // fake

    db._ready = commonUtils.resolveFactory(); // fake

    db._localChanges = commonUtils.resolveFactory([]); // fake

    db._emitChanges = function () {
      emitted = true;
    };

    return db._findAndEmitChanges().then(function () {
      emitted.should.eql(false);
    });
  });

  it('should find and emit when not connected', function () {
    // It is very hard to reliably guarantee the following race condition using e2e testing so we
    // test here
    var emitted = false;

    createClientAndDB();

    db._connected = false; // fake

    db._ready = commonUtils.resolveFactory(); // fake

    db._localChanges = commonUtils.resolveFactory([{
      foo: 'bar'
    }]); // fake

    db._emitChanges = function () {
      emitted = true;
    };

    return db._findAndEmitChanges().then(function () {
      emitted.should.eql(false);
    });
  });

  it('should build init msg with filters turned off', function () {
    createClientAndDB({
      filter: false
    });
    return commonUtils.once(db, 'load').then(function () {
      var msg = db._emitInitMsg();
      msg.filter.should.eql(false);
    });
  });

  it('should limit local changes within collection', function () {

    createClientAndDB();

    var tasks = db.col('tasks');

    var limit = 2,
      n = 0,
      promises = [];

    // Populate docs
    for (var i = 0; i < 10; i++) {
      var task = tasks.doc({
        thing: 'paint'
      });
      promises.push(task.save());
    }

    return Promise.all(promises).then(function () {
      return db._localChanges(null, null, limit, n);
    }).then(function (changes) {
      // Make sure changes limited
      changes.changes.length.should.eql(limit);
    });
  });

  it('should limit local changes across collections', function () {
    var promises = [],
      limit = 1,
      n = 0;

    createClientAndDB();

    var tasks = db.col('tasks');
    var users = db.col('users');

    promises.push(tasks.doc({
      thing: 'paint'
    }).save());

    promises.push(users.doc({
      name: 'myuser'
    }).save());

    return Promise.all(promises).then(function () {
      return db._localChanges(null, null, limit, n);
    }).then(function (changes) {
      // Make sure changes limited
      changes.changes.length.should.eql(limit);
    });
  });

  it('should find and emit changes in batches', function () {
    var timesEmitted = 0,
      promises = [];

    createClientAndDB();

    db._batchSize = 3;

    var tasks = db.col('tasks');

    db._emitChanges = function () {
      timesEmitted++;
    };

    // Populate docs
    for (var i = 0; i < 10; i++) {
      var task = tasks.doc({
        thing: 'paint' + i
      });
      promises.push(task.save());
    }

    return Promise.all(promises).then(function () {
      return db._findAndEmitAllChangesInBatches();
    }).then(function () {
      // ceil(10/3) = 4
      timesEmitted.should.eql(4);
    });
  });

  it('should add role', function () {
    createClientAndDB();

    var mockDocs = function (doc) {
      var nowStr = (new Date()).toISOString();

      var changes = [{
        id: doc.id(),
        col: doc._col._name,
        name: clientUtils.ATTR_NAME_ROLE,
        val: JSON.stringify({
          action: clientUtils.ACTION_ADD,
          userUUID: 'user-uuid',
          roleName: 'my-role'
        }),
        up: nowStr,
        re: nowStr
      }];

      db._setChanges(changes);
    };

    // Mock recording of docs
    db._resolveAfterRoleCreated = function (userUUID, roleName, doc) {
      return Promise.all([
        DB.prototype._resolveAfterRoleCreated.apply(this, arguments),
        mockDocs(doc) // mock docs after listener binds
      ]);
    };

    // Assume success if there is no error
    return db.addRole('user-uuid', 'my-role');
  });

  it('should remove role', function () {
    createClientAndDB();

    var mockDocs = function (doc) {
      var nowStr = (new Date()).toISOString();

      var changes = [ {
        id: doc.id(),
        col: doc._col._name,
        name: clientUtils.ATTR_NAME_ROLE,
        val: JSON.stringify({
          action: clientUtils.ACTION_REMOVE,
          userUUID: 'user-uuid',
          roleName: 'my-role'
        }),
        up: nowStr,
        re: nowStr
      } ];

      db._setChanges(changes);
    };

    // Mock recording of docs
    db._resolveAfterRoleDestroyed = function (userUUID, roleName, doc) {
      return Promise.all([
        DB.prototype._resolveAfterRoleDestroyed.apply(this, arguments),
        mockDocs(doc) // mock docs after listener binds
      ]);
    };

    // Assume success if there is no error
    return db.removeRole('user-uuid', 'my-role');
  });

  it('should create database', function () {
    createClientAndDB();
    // Assume success if there is no error
    return db._createDatabase('my-other-db');
  });

  it('should destroy database', function () {
    createClientAndDB();
    // Assume success if there is no error
    return db._destroyDatabase('my-other-db');
  });
});
