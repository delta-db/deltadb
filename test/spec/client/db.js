'use strict';

var DB = require('../../../scripts/client/db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  clientUtils = require('../../../scripts/client/utils'),
  commonUtils = require('../../common-utils'),
  utils = require('../../../scripts/utils'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Promise = require('bluebird');

describe('db', function () {

  var db = null;

  afterEach(function () {
    if (db) {
      return db.destroy(true);
    }
  });

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
    return clientUtils.timeout().then(function () {
      db = client.db({
        db: 'mydb',
        store: new MemAdapter().db('mydb')
      });
      return clientUtils.once(db, 'load');
    });
  });

  it('should throw delta errors', function () {
    var client = new Client(true);
    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });
    return commonUtils.shouldNonPromiseThrow(function () {
      db._onDeltaError(new Error('my err'));
    }, new Error('my err'));
  });

  it('should find and emit when no changes', function () {
    // It is very hard to reliably guarantee the following race condition using e2e testing so we
    // test here
    var emitted = false,
      client = new Client(true);

    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });

    db._connected = true; // fake

    db._ready = utils.resolveFactory(); // fake

    db._localChanges = utils.resolveFactory([]); // fake

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
    var emitted = false,
      client = new Client(true);

    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });

    db._connected = false; // fake

    db._ready = utils.resolveFactory(); // fake

    db._localChanges = utils.resolveFactory([{
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
    var client = new Client(true);
    var db = client.db({
      db: 'mydb',
      filter: false
    });
    return clientUtils.once(db, 'load').then(function () {
      var msg = db._emitInitMsg();
      msg.filter.should.eql(false);
    });
  });

  it('should limit local changes within collection', function () {
    var client = new Client(true);

    var db = client.db({
      db: 'mydb'
    });

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
    var client = new Client(true),
      promises = [],
      limit = 1,
      n = 0;

    var db = client.db({
      db: 'mydb'
    });

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
      client = new Client(true),
      promises = [];

    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });

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

});
