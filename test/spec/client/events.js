'use strict';

// TODO: error event?

// TODO: split up tests by event

var utils = require('../../../scripts/utils'),
  commonUtils = require('../../common-utils'),
  Client = require('../../../scripts/client/adapter'),
  Promise = require('bluebird'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('events', function () {

  var client = null,
    db = null,
    tasks = null,
    task = null,
    client2 = null,
    db2 = null;

  beforeEach(function () {
    client = new Client(true);

    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb') // TODO: test with default store?
    });

    tasks = db.col('tasks');

    task = tasks.doc({
      $id: '1'
    });
  });

  afterEach(function () {
    return Promise.all([db.destroy(true), db2 ? db.destroy(true) : null]);
  });

  var Server = function (changes) {
    this.queue = function () {};

    this.changes = function () {
      return changes;
    };
  };

  var now = new Date(),
    nowStr = now.toISOString(),
    before = new Date('2015-01-01'),
    beforeStr = before.toISOString(),
    later = new Date(now.getTime() + 1),
    laterStr = later.toISOString();

  var eventArgsShouldEql = function (args, id, name, value) {
    args[0].name.should.eql(name);
    args[0].value.should.eql(value);
    args[1].id().should.eql(id);
  };

  var createLocalShouldEql = function (args) {
    eventArgsShouldEql(args, '1', 'priority', 'low');
  };

  var createRemoteShouldEql = function (args) {
    eventArgsShouldEql(args, '1', 'thing', 'sing');
  };

  // -----

  var createLocal = function () {
    task._set('priority', 'low', now); // use _set so we can force a timestamp
    return task.save(); // doc not registered with collection until save()
  };

  var attrShouldCreateLocal = function (emitter) {
    return commonUtils.shouldDoAndOnce(createLocal, emitter, 'attr:create').then(function (
      args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:create local', function () {
    attrShouldCreateLocal(task);
  });

  it('col: attr:create local', function () {
    attrShouldCreateLocal(tasks);
  });

  it('db: attr:create local', function () {
    attrShouldCreateLocal(db);
  });

  it('client: attr:create local', function () {
    attrShouldCreateLocal(client);
  });

  var createRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'thing',
      val: '"sing"',
      seq: 0,
      up: nowStr,
      re: nowStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldCreateRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(createRemote, emitter, 'attr:create');
    }).then(function (args) {
      createRemoteShouldEql(args);
    });
  };

  it('doc: attr:create remote', function () {
    return attrShouldCreateRemote(task);
  });

  it('col: attr:create remote', function () {
    return attrShouldCreateRemote(tasks);
  });

  it('db: attr:create remote', function () {
    return attrShouldCreateRemote(db);
  });

  it('client: attr:create remote', function () {
    return attrShouldCreateRemote(client);
  });

  var createRemoteSame = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      seq: 0,
      up: nowStr,
      re: nowStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldCreateRemoteSame = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndNotOnce(createRemoteSame, emitter, 'attr:create');
    });
  };

  it('doc: attr:create remote same', function () {
    // TODO: does this one test cover the code path for all events?
    // TODO: better to just test all cases of Doc._event?? Probably!
    return attrShouldCreateRemoteSame(task);
  });

  var createRemoteEarlier = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      seq: 0,
      up: beforeStr,
      re: beforeStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldCreateRemoteEarlier = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndNotOnce(createRemoteEarlier, emitter, 'attr:create');
    });
  };

  it('doc: attr:create remote earlier', function () {
    // TODO: does this one test cover the code path for all events?
    // TODO: better to just test all cases of Doc._event?? Probably!
    return attrShouldCreateRemoteEarlier(task);
  });

  // ------------------------

  var updateLocal = function () {
    return commonUtils.sleep().then(function () { // sleep so update is after create
      task.set({
        'priority': 'high'
      }); // use _set so we can force a timestamp
      return null; // prevent runaway promise warnings
    });
  };

  var updateShouldEql = function (args) {
    eventArgsShouldEql(args, '1', 'priority', 'high');
  };

  var attrShouldUpdateLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(updateLocal, emitter, 'attr:update');
    }).then(function (args) {
      updateShouldEql(args);
    });
  };

  it('doc: attr:update local', function () {
    return attrShouldUpdateLocal(task);
  });

  it('col: attr:update local', function () {
    return attrShouldUpdateLocal(tasks);
  });

  it('db: attr:update local', function () {
    return attrShouldUpdateLocal(db);
  });

  it('client: attr:update local', function () {
    return attrShouldUpdateLocal(client);
  });

  var updateRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"high"',
      seq: 0,
      up: laterStr,
      re: laterStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldUpdateRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(updateRemote, emitter, 'attr:update');
    }).then(function (args) {
      updateShouldEql(args);
    });
  };

  it('doc: attr:update remote', function () {
    return attrShouldUpdateRemote(task);
  });

  it('col: attr:update remote', function () {
    return attrShouldUpdateRemote(tasks);
  });

  it('db: attr:update remote', function () {
    return attrShouldUpdateRemote(db);
  });

  it('client: attr:update remote', function () {
    return attrShouldUpdateRemote(client);
  });

  // ------------------------

  var destroyLocal = function () {
    return commonUtils.sleep().then(function () { // sleep so destroy is after create
      task.unset('priority'); // use _set so we can force a timestamp
      return null; // prevent runaway promise warnings
    });
  };

  var attrShouldDestroyLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(destroyLocal, emitter, 'attr:destroy');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:destroy local', function () {
    return attrShouldDestroyLocal(task);
  });

  it('col: attr:destroy local', function () {
    return attrShouldDestroyLocal(tasks);
  });

  it('db: attr:destroy local', function () {
    return attrShouldDestroyLocal(db);
  });

  it('client: attr:destroy local', function () {
    return attrShouldDestroyLocal(client);
  });

  var destroyRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      seq: 0,
      up: laterStr,
      re: laterStr
    }]);

    return commonUtils.sleep().then(function () { // sleep so destroy is after create
      return db.sync(server, true);
    });
  };

  var attrShouldDestroyRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(destroyRemote, emitter, 'attr:destroy');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:destroy remote', function () {
    return attrShouldDestroyRemote(task);
  });

  it('col: attr:destroy remote', function () {
    return attrShouldDestroyRemote(tasks);
  });

  it('db: attr:destroy remote', function () {
    return attrShouldDestroyRemote(db);
  });

  it('client: attr:destroy remote', function () {
    return attrShouldDestroyRemote(client);
  });

  // ------------------------

  var recordRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      seq: 0,
      up: nowStr,
      re: laterStr
    }]);

    return commonUtils.sleep().then(function () { // sleep so record is after create
      return db.sync(server, true);
    });
  };

  var attrShouldRecord = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(recordRemote, emitter, 'attr:record');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:record', function () {
    return attrShouldRecord(task);
  });

  it('col: attr:record', function () {
    return attrShouldRecord(tasks);
  });

  it('db: attr:record', function () {
    return attrShouldRecord(db);
  });

  it('client: attr:record', function () {
    return attrShouldRecord(client);
  });

  // ------------------------

  var docCreateShouldEql = function (args) {
    args[0].should.eql(task);
  };

  var docShouldCreateLocal = function (emitter) {
    return commonUtils.shouldDoAndOnce(createLocal, emitter, 'doc:create').then(function (
      args) {
      docCreateShouldEql(args);
    });
  };

  it('doc: doc:create local', function () {
    return docShouldCreateLocal(task);
  });

  it('col: doc:create local', function () {
    return docShouldCreateLocal(tasks);
  });

  it('db: doc:create local', function () {
    return docShouldCreateLocal(db);
  });

  it('client: doc:create local', function () {
    return docShouldCreateLocal(client);
  });

  var argsShouldEqlTask = function (args) {
    return tasks.get('1').then(function (newTask) {
      args[0].should.eql(newTask);
    });
  };

  var docShouldCreateRemote = function (emitter) {
    return commonUtils.shouldDoAndOnce(createRemote, emitter, 'doc:create').then(function (
      args) {
      return argsShouldEqlTask(args);
    });
  };

  it('doc: doc:create remote already local', function () {
    return utils.doAndOnce(createLocal, task, 'doc:create').then(function () {
      // Assert doc:create not received as already created
      return commonUtils.shouldDoAndNotOnce(createRemote, task, 'doc:create');
    });
  });

  it('col: doc:create remote', function () {
    return docShouldCreateRemote(tasks);
  });

  it('db: doc:create remote', function () {
    return docShouldCreateRemote(db);
  });

  it('client: doc:create remote', function () {
    return docShouldCreateRemote(client);
  });

  // ------------------------

  var docShouldUpdateLocal = function (emitter) {
    return commonUtils.shouldDoAndOnce(updateLocal, emitter, 'doc:update').then(function (
      args) {
      args[0].should.eql(task);
    });
  };

  it('doc: doc:update local', function () {
    return docShouldUpdateLocal(task);
  });

  it('col: doc:update local', function () {
    return docShouldUpdateLocal(tasks);
  });

  it('db: doc:update local', function () {
    return docShouldUpdateLocal(db);
  });

  it('client: doc:update local', function () {
    return docShouldUpdateLocal(client);
  });

  var docShouldUpdateRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'doc:create').then(function () {
      return commonUtils.shouldDoAndOnce(updateRemote, emitter, 'doc:update');
    }).then(function (args) {
      return argsShouldEqlTask(args);
    });
  };

  it('doc: doc:update remote', function () {
    return docShouldUpdateRemote(task);
  });

  it('col: doc:update remote', function () {
    return docShouldUpdateRemote(tasks);
  });

  it('db: doc:update remote', function () {
    return docShouldUpdateRemote(db);
  });

  it('client: doc:update remote', function () {
    return docShouldUpdateRemote(client);
  });

  // ------------------------

  var docDestroyShouldEql = function (args) {
    docCreateShouldEql(args);
  };

  var destroyDocLocal = function () {
    return commonUtils.sleep().then(function () { // sleep so destroy is after create
      return task.destroy();
    });
  };

  var docShouldDestroyLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(destroyDocLocal, emitter, 'doc:destroy');
    }).then(function (args) {
      docDestroyShouldEql(args);
    });
  };

  it('doc: doc:destroy local', function () {
    return docShouldDestroyLocal(task);
  });

  it('col: doc:destroy local', function () {
    return docShouldDestroyLocal(tasks);
  });

  it('db: doc:destroy local', function () {
    return docShouldDestroyLocal(db);
  });

  it('client: doc:destroy local', function () {
    return docShouldDestroyLocal(client);
  });

  var destroyDocRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: null,
      seq: 0,
      up: laterStr,
      re: laterStr
    }]);

    return commonUtils.sleep().then(function () { // sleep so destroy is after create
      return db.sync(server, true);
    });
  };

  var docShouldDestroyRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(destroyDocRemote, emitter, 'doc:destroy');
    }).then(function (args) {
      docDestroyShouldEql(args);
    });
  };

  it('doc: doc:destroy remote', function () {
    return docShouldDestroyRemote(task);
  });

  it('col: doc:destroy remote', function () {
    return docShouldDestroyRemote(tasks);
  });

  it('db: doc:destroy remote', function () {
    return docShouldDestroyRemote(db);
  });

  it('client: doc:destroy remote', function () {
    return docShouldDestroyRemote(client);
  });

  // ------------------------

  var docShouldRecord = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'doc:create').then(function () {
      return commonUtils.shouldDoAndOnce(recordRemote, emitter, 'doc:record');
    }).then(function (args) {
      docCreateShouldEql(args);
    });
  };

  it('doc: doc:record', function () {
    return docShouldRecord(task);
  });

  it('col: doc:record', function () {
    return docShouldRecord(tasks);
  });

  it('db: doc:record', function () {
    return docShouldRecord(db);
  });

  it('client: doc:record', function () {
    return docShouldRecord(client);
  });

  // ------------------------

  var tasks2 = null;

  var colCreateShouldEql = function (args) {
    args[0].should.eql(tasks2);
  };

  var colCreateLocal = function () {
    tasks2 = db.col('tasks2');
    return Promise.resolve();
  };

  var colShouldCreateLocal = function (emitter) {
    return commonUtils.shouldDoAndOnce(colCreateLocal, emitter, 'col:create').then(function (
      args) {
      colCreateShouldEql(args);
    });
  };

  // Note: no col:create at col layer as col:create emitted immediately after db.col()

  it('db: col:create local', function () {
    return colShouldCreateLocal(db);
  });

  it('client: col:create local', function () {
    return colShouldCreateLocal(client);
  });

  var colCreateRemote = function () {
    var server = new Server([{
      id: '2',
      col: 'tasks2',
      name: 'thing',
      val: '"sing"',
      seq: 0,
      up: nowStr,
      re: nowStr
    }]);
    return db.sync(server, true);
  };

  var colShouldCreateRemote = function (emitter) {
    return commonUtils.shouldDoAndOnce(colCreateRemote, emitter, 'col:create').then(function (
      args) {
      return args[0].get('2');
    }).then(function (doc) {
      var obj = doc.get();
      obj.thing.should.eql('sing');
    });
  };

  it('db: col:create remote', function () {
    return colShouldCreateRemote(db);
  });

  it('client: col:create remote', function () {
    return colShouldCreateRemote(client);
  });

  // ------------------------

  var colShouldUpdateLocal = function (emitter) {
    return commonUtils.shouldDoAndOnce(updateLocal, emitter, 'col:update').then(function (
      args) {
      return args[0].get('1');
    }).then(function (doc) {
      var obj = doc.get();
      obj.priority.should.eql('high');
    });
  };

  it('col: col:update local', function () {
    return colShouldUpdateLocal(tasks);
  });

  it('db: col:update local', function () {
    return colShouldUpdateLocal(db);
  });

  it('client: col:update local', function () {
    return colShouldUpdateLocal(client);
  });

  var colShouldUpdateRemote = function (emitter) {
    // We cannot first listen to col:create as the col was created with db.col()
    return utils.doAndOnce(createLocal, emitter, 'doc:create').then(function () {
      return commonUtils.shouldDoAndOnce(updateRemote, emitter, 'col:update');
    }).then(function (args) {
      return args[0].get('1');
    }).then(function (doc) {
      var obj = doc.get();
      obj.priority.should.eql('high');
    });
  };

  it('col: col:update remote', function () {
    return colShouldUpdateRemote(tasks);
  });

  it('db: col:update remote', function () {
    return colShouldUpdateRemote(db);
  });

  it('client: col:update remote', function () {
    return colShouldUpdateRemote(client);
  });

  // ------------------------

  var destroyColLocal = function () {
    return commonUtils.sleep().then(function () { // sleep so destroy is after create
      return tasks.destroy();
    });
  };

  var colShouldDestroyLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(destroyColLocal, emitter, 'col:destroy');
    }).then(function (args) {
      return args[0].get('1');
    }).then(function (doc) {
      var obj = doc.get();
      obj.priority.should.eql('low');
    });
  };

  it('col: col:destroy local', function () {
    return colShouldDestroyLocal(tasks);
  });

  it('db: col:destroy local', function () {
    return colShouldDestroyLocal(db);
  });

  it('client: col:destroy local', function () {
    return colShouldDestroyLocal(client);
  });

  // TODO: create construct for passing col destroy via delta? e.g. { name: '$col', value: null } so
  // that we can emit col:destroy when receive this delta?

  // ------------------------

  var colShouldRecord = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'doc:create').then(function () {
      return commonUtils.shouldDoAndOnce(recordRemote, emitter, 'col:record');
    }).then(function (args) {
      return args[0].get('1');
    }).then(function (doc) {
      var obj = doc.get();
      obj.priority.should.eql('low');
    });
  };

  it('col: col:record', function () {
    return colShouldRecord(tasks);
  });

  it('db: col:record', function () {
    return colShouldRecord(db);
  });

  it('client: col:record', function () {
    return colShouldRecord(client);
  });

  // ------------------------

  var dbCreateLocal = function () {
    db2 = client2.db({
      db: 'myotherdb',
      store: new MemAdapter().db('mydb') // TODO: test with default store?
    });
    return Promise.resolve();
  };

  var dbShouldCreateLocal = function () {
    client2 = new Client(true);
    return commonUtils.shouldDoAndOnce(dbCreateLocal, client2, 'db:create').then(function (
      args) {
      args[0].should.eql(db2);
    });
  };

  it('client: db:create local', function () {
    return dbShouldCreateLocal();
  });

  // TODO: how can the client detect that a database has been created remotely? Currently, syncing
  // is done per database and instead we would require a notification at the layer above.

  // ------------------------

  // Note: we don't support db:update as there is no database rename function and no other way to
  // update a database.

  // ------------------------

  // var dbDestroyLocal = function () {
  //   return client2.connect({
  //     db: 'myotherdb'
  //   }).then(function (_db2) {
  //     db2 = _db2;
  //   }).then(function () {
  //     return db2.destroy();
  //   });
  // };

  // var dbShouldDestroyLocal = function () {
  //   return commonUtils.shouldDoAndOnce(dbDestroyLocal, client2, 'db:destroy').then(function (
  //     args) {
  //     args[0].should.eql(db2);
  //   });
  // };

  // TODO: need to first implement db.destroy()
  // it('client: db:destroy local', function () {
  //   return dbShouldDestroyLocal();
  // });

  // TODO: how can the client detect that a database has been destroyed remotely? Currently, syncing
  // is done per database and instead we would require a notification at the layer above.

  // ------------------------

  var dbShouldRecord = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return commonUtils.shouldDoAndOnce(recordRemote, emitter, 'db:record');
    }).then(function (args) {
      args[0].should.eql(db);
    });
  };

  it('db: db:record', function () {
    return dbShouldRecord(db);
  });

  it('client: db:record', function () {
    return dbShouldRecord(client);
  });

});
