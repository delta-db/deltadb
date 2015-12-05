'use strict';

// TODO: split up

var utils = require('../../../scripts/utils'),
  commonUtils = require('../../common-utils'),
  Client = require('../../../scripts/client/adapter'),
  Doc = require('../../../scripts/client/doc'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('client', function () {

  var client = null,
    db = null,
    tasks = null;

  beforeEach(function () {
    client = new Client(true);

    db = client.db({
      db: 'mydb',

      // TODO: we use a MemAdapter here to avoid issues with rapidly create/destroying IndexedDB
      // DBs. Is there a better way?
      store: new MemAdapter().db('mydb')
    });

    tasks = db.col('tasks');
  });

  afterEach(function () {
    return db.destroy();
  });

  var latestShouldEql = function (expected) {
    // TODO: ensure up in the last couple seconds
    return tasks.all(function (doc) {
      var exp = expected[doc.id()];
      (typeof exp !== 'undefined').should.eql(true);
      utils.each(exp, function (attr) {
        if (typeof attr.seq === 'undefined') {
          attr.seq = 0;
        }
      });
      doc._dat.latest.should.eql(exp);
    });
  };

  var up = new Date('01/01/2014 08:00'),
    upStr = up.toISOString();

  var re = new Date(),
    reStr = re.toISOString();

  var remoteChanges = [{
    id: '1',
    col: 'tasks',
    name: 'thing',
    val: '"write a song"',
    up: upStr,
    re: reStr
  }, {
    id: '1',
    col: 'tasks',
    name: 'priority',
    val: '"high"',
    up: upStr,
    re: reStr,
    seq: 0
  }, {
    id: '1',
    col: 'tasks',
    name: 'priority',
    val: '"low"',
    up: upStr,
    re: reStr,
    seq: 1
  }, {
    id: '2',
    col: 'tasks',
    name: 'thing',
    val: '"sing a song"',
    up: upStr,
    re: reStr
  }, {
    id: '2',
    col: 'tasks',
    name: 'priority',
    val: '"medium"',
    up: upStr,
    re: reStr
  }];

  var Server = function () {
    this.queue = function () {};

    this.changes = function () {
      return typeof this.remoteChanges === 'undefined' ? remoteChanges : this.remoteChanges;
    };
  };

  // Convenience method as seq is only present if > 0
  var changesShouldEql = function (expected, actual) {
    expected.forEach(function (change) {
      if (typeof change.seq === 'undefined') {
        delete change.seq;
      }
    });
    actual.should.eql(expected);
  };

  it('should set doc', function () {
    var task1 = tasks.doc({
      thing: 'write a song',
      priority: 'high',
      type: 'fun'
    });
    return task1.save().then(function () {
      return task1.set({
        thing: 'sing a song',
        priority: 'medium'
      });
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      // Note: the second set of seq numbers could be non-zero if the timestamps are the same
      var changes = _changes.changes;
      changesShouldEql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'thing',
          val: '"write a song"',
          up: changes[0].up
        }, {
          id: changes[1].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[1].up
        }, {
          id: changes[2].id,
          col: 'tasks',
          name: 'type',
          val: '"fun"',
          up: changes[2].up
        }, {
          id: changes[3].id,
          col: 'tasks',
          name: 'thing',
          val: '"sing a song"',
          up: changes[3].up,
          seq: changes[3].seq
        }, {
          id: changes[4].id,
          col: 'tasks',
          name: 'priority',
          val: '"medium"',
          up: changes[4].up,
          seq: changes[4].seq
        }], changes);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        thing: {
          val: 'sing a song',
          up: new Date(changes[3].up),
          seq: changes[3].seq
        },
        priority: {
          val: 'medium',
          up: new Date(changes[4].up),
          seq: changes[4].seq
        },
        type: {
          val: 'fun',
          up: new Date(changes[2].up),
          seq: changes[2].seq
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should handle back-to-back changes', function () {
    var task1 = tasks.doc({
        priority: 'high'
      }),
      updated = null,
      nextUpdated = null;
    // For some reason, waiting 1 millisecond can still occassionally result in all changes having
    // the same timestamp so we'll bump it to 2 milliseconds
    return commonUtils.sleep().then(function () { // make sure changes occur at later timestamp
      updated = new Date(); // use the same updated date for the next 2 updates
      task1._set('priority', 'low', updated);
      task1._set('priority', 'medium', updated);
      return task1.save();
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[0].up
        }, {
          id: changes[1].id,
          col: 'tasks',
          name: 'priority',
          val: '"low"',
          up: updated.toISOString()
        }, {
          id: changes[2].id,
          col: 'tasks',
          name: 'priority',
          val: '"medium"',
          up: updated.toISOString(),
          seq: 1
        }]);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        priority: {
          val: 'medium',
          up: updated,
          seq: 1
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.sleep(); // ensure different timestamp for upcoming change
    }).then(function () {
      // Make another update at later timestamp and make sure the seq is 0
      nextUpdated = new Date();
      task1._set('priority', 'high', nextUpdated);
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[0].up
        }, {
          id: changes[1].id,
          col: 'tasks',
          name: 'priority',
          val: '"low"',
          up: updated.toISOString()
        }, {
          id: changes[2].id,
          col: 'tasks',
          name: 'priority',
          val: '"medium"',
          up: updated.toISOString(),
          seq: 1
        }, {
          id: changes[2].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: nextUpdated.toISOString()
        }]);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        priority: {
          val: 'high',
          up: nextUpdated,
          seq: 0
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should handle update followed immediately by attr deletion', function () {
    var task1 = tasks.doc({}),
      updated = null;
    updated = new Date(); // use the same updated date for the next 2 changes
    task1._set('priority', 'low', updated);
    return task1.unset('priority', updated).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"low"',
          up: updated.toISOString()
        }, {
          id: changes[1].id,
          col: 'tasks',
          name: 'priority',
          up: updated.toISOString(),
          seq: 1
        }]);

      // check latest
      var latest = {};
      // seq=1 as set and unset at same time
      latest[changes[0].id] = {
        priority: {
          val: undefined,
          up: updated,
          seq: 1
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should handle update followed immediately by doc deletion', function () {
    var task1 = tasks.doc({});
    var updated = new Date(); // use the same updated date for the next 2 changes
    task1._set('priority', 'low', updated);
    return task1.save().then(function () {
      return task1.destroy(updated);
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"low"',
          up: updated.toISOString()
        }, {
          id: changes[1].id,
          col: 'tasks',
          up: updated.toISOString()
        }]);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        priority: {
          val: 'low',
          up: updated,
          seq: 0
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should track local changes', function () {
    var task1 = tasks.doc({
      thing: 'write a song',
      priority: 'high'
    });
    return task1.save().then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'thing',
          val: '"write a song"',
          up: changes[0].up
        }, {
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[1].up
        }]);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        thing: {
          val: 'write a song',
          up: new Date(changes[0].up)
        },
        priority: {
          val: 'high',
          up: new Date(changes[1].up)
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      task1._set('priority', 'low');
      return task1.save();
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {

      // check local changes
      // TODO: ensure up in the last couple seconds
      // priority=low, seq could be 1 if updates on same timestamp
      var changes = _changes.changes;
      changesShouldEql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'thing',
          val: '"write a song"',
          up: changes[0].up
        }, {
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[1].up
        }, {
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"low"',
          up: changes[2].up,
          seq: changes[2].seq
        }], changes);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        thing: {
          val: 'write a song',
          up: new Date(changes[0].up)
        },
        priority: {
          val: 'low',
          up: new Date(changes[2].up),
          seq: changes[2].seq
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      var task2 = tasks.doc({
        thing: 'sing a song',
        priority: 'medium'
      });
      return task2.save();
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure "up" in the last couple seconds
      var changes = _changes.changes;
      changesShouldEql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'thing',
          val: '"write a song"',
          up: changes[0].up
        }, {
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[1].up
        }, {
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"low"',
          up: changes[2].up,
          seq: changes[2].seq
        }, {
          id: changes[3].id,
          col: 'tasks',
          name: 'thing',
          val: '"sing a song"',
          up: changes[3].up
        }, {
          id: changes[4].id,
          col: 'tasks',
          name: 'priority',
          val: '"medium"',
          up: changes[4].up
        }], changes);

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        thing: {
          val: 'write a song',
          up: new Date(changes[0].up),
          seq: 0
        },
        priority: {
          val: 'low',
          up: new Date(changes[2].up),
          seq: changes[2].seq
        }
      };
      latest[changes[3].id] = {
        thing: {
          val: 'sing a song',
          up: new Date(changes[3].up),
          seq: 0
        },
        priority: {
          val: 'medium',
          up: new Date(changes[4].up),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should process remote changes', function () {
    return db._setChanges(remoteChanges).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        thing: 'write a song',
        priority: 'low'
      }, {
        $id: '2',
        thing: 'sing a song',
        priority: 'medium'
      }]);
    }).then(function () {
      return db._localChanges();
    }).then(function () {
      // Note: local changes don't get updated as not responisbility of client to say pass on this
      // information if say client chooses to sync with different server later
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'low',
          up: up,
          seq: 1,
          re: re
        },
        thing: {
          val: 'write a song',
          up: up,
          seq: 0,
          re: re
        }
      };
      latest['2'] = {
        priority: {
          val: 'medium',
          up: up,
          seq: 0,
          re: re
        },
        thing: {
          val: 'sing a song',
          up: up,
          seq: 0,
          re: re
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should preserve later change', function () {
    var up = new Date('01/01/2014 08:00').toISOString();
    return db._setChanges(
        [{
          id: '1',
          col: 'tasks',
          name: 'thing',
          val: '"write a song"',
          up: up,
          seq: 0
        }, {
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: up,
          seq: 0
        }])
      .then(function () {
        return commonUtils.allShouldEql(tasks, [{
          $id: '1',
          thing: 'write a song',
          priority: 'high'
        }]);
      }).then(function () {
        var old = new Date('01/01/2014 07:00').toISOString();
        return db._setChanges(
          [{
            id: '1',
            col: 'tasks',
            name: 'priority',
            val: '"low"',
            up: old,
            seq: 0
          }]);
      }).then(function () {
        return commonUtils.allShouldEql(tasks, [{
          $id: '1',
          thing: 'write a song',
          priority: 'high'
        }]);
      });
  });

  it('should sync', function () {
    var server = new Server(); // mock server

    server.queue = function (changes) {
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'thing',
          val: '"play a song"',
          up: changes[0].up
        }, {
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[1].up
        }]);
    };

    var task1 = tasks.doc({
        thing: 'play a song',
        priority: 'high'
      }),
      thingUpdated = null,
      priorityUpdated = null;

    return task1.save().then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      var changes = _changes.changes;
      thingUpdated = new Date(changes[0].up);
      priorityUpdated = new Date(changes[1].up);
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      var changes = _changes.changes;
      server.queue(changes);

      // check latest
      var latest = {};
      latest[task1.id()] = {
        thing: {
          val: 'play a song',
          up: thingUpdated,
          seq: 0
        },
        priority: {
          val: 'high',
          up: priorityUpdated,
          seq: 0
        }
      };
      latest['1'] = {
        thing: {
          val: 'write a song',
          up: up,
          seq: 0,
          re: re
        },
        priority: {
          val: 'low',
          up: up,
          seq: 1,
          re: re
        }
      };
      latest['2'] = {
        thing: {
          val: 'sing a song',
          up: up,
          seq: 0,
          re: re
        },
        priority: {
          val: 'medium',
          up: up,
          seq: 0,
          re: re
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        thing: 'write a song',
        priority: 'low'
      }, {
        $id: '2',
        thing: 'sing a song',
        priority: 'medium'
      }, {
        $id: task1.id(),
        thing: 'play a song',
        priority: 'high'
      }]);
    });
  });

  it('should process doc deletions', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:30:00.000Z'
    }];
    return db.sync(server).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        thing: 'write a song'
      }]);
    }).then(function () {
      server.remoteChanges = [{
        id: '1',
        col: 'tasks',
        up: '2014-01-01T07:00:00.000Z',
        re: '2014-01-01T08:00:00.000Z'
      }];
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      var changes = _changes.changes;
      changes.should.eql([]); // check local changes

      // check latest
      var latest = {};
      latest['1'] = {
        thing: {
          val: 'write a song',
          up: new Date('2014-01-01T05:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T05:30:00.000Z')
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, []);
    });
  });

  it('should process doc attr deletions', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:30:00.000Z'
    }, {
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:30:00.000Z'
    }];
    return db.sync(server).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        thing: 'write a song',
        priority: 'high'
      }]);
    }).then(function () {
      server.remoteChanges = [{
        id: '1',
        col: 'tasks',
        name: 'thing',
        up: '2014-01-01T07:00:00.000Z',
        re: '2014-01-01T08:00:00.000Z'
      }];
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      var changes = _changes.changes;
      changes.should.eql([]); // check local changes

      // check latest
      var latest = {};
      latest['1'] = {
        thing: {
          val: undefined,
          up: new Date('2014-01-01T07:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T08:00:00.000Z')
        },
        priority: {
          val: 'high',
          up: new Date('2014-01-01T05:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T05:30:00.000Z')
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        priority: 'high'
      }]);
    });
  });

  it('should send doc deletions', function () {
    var task1 = tasks.doc({
      priority: 'high'
    });
    return task1.save().then(function () {
      return task1.destroy();
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[0].up
        }, {
          id: changes[1].id,
          col: 'tasks',
          up: changes[1].up
        }]);

      // check latest - doc still exists as not yet recorded by quorum
      var latest = {};
      latest[changes[0].id] = {
        priority: {
          val: 'high',
          up: new Date(changes[0].up),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should send attr deletions', function () {
    var task1 = tasks.doc({
      priority: 'high'
    });
    return task1.save().then(function () {
      return task1.unset('priority');
    }).then(function () {
      return task1.save();
    }).then(function () {
      return db._localChanges();
    }).then(function (_changes) {
      // check local changes
      // TODO: ensure up in the last couple seconds
      var changes = _changes.changes;
      changesShouldEql(
        [{
          id: changes[0].id,
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: changes[0].up
        }, {
          id: changes[1].id,
          col: 'tasks',
          name: 'priority',
          up: changes[1].up,
          seq: changes[1].seq
        }], changes); // seq num may not be 0 if same timestamp

      // check latest
      var latest = {};
      latest[changes[0].id] = {
        priority: {
          val: undefined,
          up: new Date(changes[1].up),
          seq: changes[1].seq
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should sync updates', function () {
    var server = new Server(); // mock server
    server.remoteChanges = null; // nothing recorded yet
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2013-01-01T05:00:00.000Z'));
    return task1.save().then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2013-01-01T05:00:00.000Z',
          sent: changes[0].sent
        }]);

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'high',
          up: new Date('2013-01-01T05:00:00.000Z'),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      // Simulate recording of changes
      server.remoteChanges = [{
        id: '1',
        col: 'tasks',
        name: 'priority',
        val: '"high"',
        up: '2013-01-01T05:00:00.000Z',
        re: '2014-01-01T05:30:00.000Z'
      }];
      client._retrySecs = 0; // force a retry
      return db.sync(server);
    }).then(function () {
      return db._localChanges(); // get all local changes
    }).then(function (_changes) {
      var changes = _changes.changes;
      changes.should.eql([]); // check local changes

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'high',
          up: new Date('2013-01-01T05:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T05:30:00.000Z')
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should sync doc deletions', function () {
    var server = new Server(); // mock server
    server.remoteChanges = null; // nothing recorded yet
    var destroyedAt = null;
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2013-01-01T05:00:00.000Z'));
    return task1.save().then(function () {
      return task1.destroy();
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2013-01-01T05:00:00.000Z',
          sent: changes[0].sent
        }, {
          id: '1',
          col: 'tasks',
          up: changes[1].up,
          sent: changes[1].sent
        }]);
      destroyedAt = changes[1].up;

      // check latest - del not yet recorded by server
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'high',
          up: new Date('2013-01-01T05:00:00.000Z'),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      // Simulate recording of changes
      server.remoteChanges = [{
        id: '1',
        col: 'tasks',
        name: 'priority',
        val: '"high"',
        up: '2013-01-01T05:00:00.000Z',
        re: '2014-01-01T05:30:00.000Z'
      }, {
        id: '1',
        col: 'tasks',
        up: destroyedAt,
        re: '2014-01-01T05:30:00.000Z'
      }];
      client._retrySecs = 0; // force a retry
      return db.sync(server);
    }).then(function () {
      return db._localChanges(); // get all local changes
    }).then(function (_changes) {
      var changes = _changes.changes;
      changes.should.eql([]); // check local changes

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'high',
          up: new Date('2013-01-01T05:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T05:30:00.000Z')
        }
      };
      return latestShouldEql(latest);
    });
  });

  it('should sync attr deletions', function () {
    var server = new Server(); // mock server
    server.remoteChanges = null; // nothing recorded yet
    var destroyedAt = null;
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2013-01-01T05:00:00.000Z'));
    return task1.save().then(function () {
      return task1.unset('priority');
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      destroyedAt = changes[1].up;
      changesShouldEql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2013-01-01T05:00:00.000Z',
          sent: changes[0].sent
        }, {
          id: '1',
          col: 'tasks',
          name: 'priority',
          up: destroyedAt,
          seq: changes[1].seq,
          sent: changes[1].sent
        }], changes);

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: undefined,
          up: new Date(destroyedAt),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      // Simulate recording of changes
      server.remoteChanges = [{
        id: '1',
        col: 'tasks',
        name: 'priority',
        val: '"high"',
        up: '2013-01-01T05:00:00.000Z',
        re: '2014-01-01T05:30:00.000Z'
      }, {
        id: '1',
        col: 'tasks',
        name: 'priority',
        up: destroyedAt,
        re: '2014-01-01T05:30:00.000Z'
      }];
      client._retrySecs = 0; // force a retry
      return db.sync(server);
    }).then(function () {
      return db._localChanges(); // get all local changes
    }).then(function (_changes) {
      var changes = _changes.changes;
      changes.should.eql([]); // check local changes

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: undefined,
          up: new Date(destroyedAt),
          seq: 0,
          re: new Date('2014-01-01T05:30:00.000Z')
        }
      };
      return latestShouldEql(latest);
    });
  });

  // TODO: test retry changes when haven't received recorded_at back

  it('should ignore doc deletions when local update latest', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:00:00.000Z'
    }];
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2014-01-01T06:00:00.000Z'));
    return task1.save().then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T06:00:00.000Z',
          sent: changes[0].sent
        }]);

      // check latest - doc not destroyed as the local change is the latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'high',
          up: new Date('2014-01-01T06:00:00.000Z'),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        priority: 'high'
      }]);
    });
  });

  it('should ignore attr deletions when local update latest', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'priority',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:00:00.000Z'
    }];
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2014-01-01T06:00:00.000Z'));
    return task1.save().then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T06:00:00.000Z',
          sent: changes[0].sent
        }]);

      // check latest - attr not destroyed as the local change is the latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'high',
          up: new Date('2014-01-01T06:00:00.000Z'),
          re: new Date('2014-01-01T05:00:00.000Z'),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        priority: 'high'
      }]);
    });
  });

  it('should process updates when doc destroyed', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:00:00.000Z'
    }];
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2014-01-01T04:00:00.000Z'));
    return task1.save().then(function () {
      return task1.destroy(new Date('2014-01-01T07:00:00.000Z'));
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // Update should be processed but doc should still remain destroyed

      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T04:00:00.000Z',
          sent: changes[0].sent
        }, {
          id: '1',
          col: 'tasks',
          up: '2014-01-01T07:00:00.000Z',
          sent: changes[1].sent
        }]);

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'low',
          up: new Date('2014-01-01T05:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T05:00:00.000Z')
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, []);
    });
  });

  it('should process updates when attr destroyed', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T05:00:00.000Z',
      re: '2014-01-01T05:00:00.000Z'
    }];
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2014-01-01T04:00:00.000Z'));
    return task1.save().then(function () {
      return task1.unset('priority', new Date('2014-01-01T07:00:00.000Z'));
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // Update should be processed but doc should still remain destroyed

      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T04:00:00.000Z',
          sent: changes[0].sent
        }, {
          id: '1',
          col: 'tasks',
          name: 'priority',
          up: '2014-01-01T07:00:00.000Z',
          sent: changes[1].sent
        }]);

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: undefined,
          up: new Date('2014-01-01T07:00:00.000Z'),
          re: new Date('2014-01-01T05:00:00.000Z'),
          seq: 0
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1'
      }]);
    });
  });

  it('should update after doc destroyed', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T06:00:00.000Z',
      re: '2014-01-01T06:00:00.000Z'
    }];
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2014-01-01T04:00:00.000Z'));
    return task1.save().then(function () {
      return task1.destroy(new Date('2014-01-01T05:00:00.000Z'));
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // Update should restore doc as update is later

      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T04:00:00.000Z',
          sent: changes[0].sent
        }, {
          id: '1',
          col: 'tasks',
          up: '2014-01-01T05:00:00.000Z',
          sent: changes[1].sent
        }]);

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'low',
          up: new Date('2014-01-01T06:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T06:00:00.000Z')
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        priority: 'low'
      }]);
    });
  });

  it('should update after attr destroyed', function () {
    var server = new Server(); // mock server
    server.remoteChanges = [{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T06:00:00.000Z',
      re: '2014-01-01T06:00:00.000Z'
    }];
    var task1 = tasks.doc({
      $id: '1'
    });
    task1._set('priority', 'high', new Date('2014-01-01T04:00:00.000Z'));
    return task1.save().then(function () {
      return task1.unset('priority', new Date('2014-01-01T05:00:00.000Z'));
    }).then(function () {
      return db.sync(server);
    }).then(function () {
      return db._localChanges(0, true); // get all local changes with sent
    }).then(function (_changes) {
      // Update should restore attr as update is later

      // check local changes - shouldn't be cleared yet as not recorded by quorum of servers
      // TODO: ensure sent in the last couple seconds
      var changes = _changes.changes;
      changes.should.eql(
        [{
          id: '1',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T04:00:00.000Z',
          sent: changes[0].sent
        }, {
          id: '1',
          col: 'tasks',
          name: 'priority',
          up: '2014-01-01T05:00:00.000Z',
          sent: changes[1].sent
        }]);

      // check latest
      var latest = {};
      latest['1'] = {
        priority: {
          val: 'low',
          up: new Date('2014-01-01T06:00:00.000Z'),
          seq: 0,
          re: new Date('2014-01-01T06:00:00.000Z')
        }
      };
      return latestShouldEql(latest);
    }).then(function () {
      return commonUtils.allShouldEql(tasks, [{
        $id: '1',
        priority: 'low'
      }]);
    });
  });

  it('should unset id', function () {
    var task1 = tasks.doc({
      priority: 'high'
    });
    task1.unset('$id');
  });

  // TODO: create db & collection layer tests and move this test accordingly
  it('should set policy', function () {

    var policy = {
      col: {
        read: 'myrole'
      }
    };

    var savedDoc = null;

    return db.policy('mycol', policy).then(function (doc) {
      savedDoc = doc;
      var col = db.col('mycol');
      return col.all(function (doc) {
        var obj = doc.get();
        obj[Doc._policyName].should.eql(policy);
        doc.should.eql(savedDoc);
      });
    });

  });

  // TODO: create db & collection layer tests and move this test accordingly
  it('should create user', function () {

    var savedDoc = null;

    return db.createUser('user-uuid', 'username', 'secret').then(function (doc) {
      savedDoc = doc;
      var col = db.col(Doc._userName);
      return col.all(function (doc) {
        var obj = doc.get();
        obj[Doc._userName].uuid.should.eql('user-uuid');
        doc.should.eql(savedDoc);
      });
    });

  });

  it('should update user', function () {

    var savedDoc = null;

    return db.updateUser('user-uuid', 'username', 'secret').then(function (doc) {
      savedDoc = doc;
      var col = db.col(Doc._userName);
      return col.all(function (doc) {
        var obj = doc.get();
        obj[Doc._userName].uuid.should.eql('user-uuid');
        doc.should.eql(savedDoc);
      });
    });

  });

  // TODO: fix
  // it('should add role', function () {
  //
  //   var savedDoc = null,
  //     userUUID = 'user-uuid',
  //     roleName = 'role-name',
  //     colName = clientUtils.NAME_PRE_USER_ROLES + userUUID;
  //
  //   return db.addRole(userUUID, roleName).then(function (doc) {
  //     savedDoc = doc;
  //     var col = db.col(colName);
  //     return col.all(function (doc) {
  //       var data = doc.get();
  //       data.userUUID.should.eql(userUUID);
  //       data.roleName.should.eql(roleName);
  //       doc.should.eql(savedDoc);
  //     });
  //   });
  //
  // });

  // TODO: fix
  // it('should remove role', function () {
  //
  //   var savedDoc = null,
  //     userUUID = 'user-uuid',
  //     roleName = 'role-name',
  //     colName = clientUtils.NAME_PRE_USER_ROLES + userUUID;
  //
  //   return db.removeRole(userUUID, roleName).then(function (doc) {
  //     savedDoc = doc;
  //     var col = db.col(colName);
  //     return col.all(function (doc) {
  //       var data = doc.get();
  //       data.userUUID.should.eql(userUUID);
  //       data.roleName.should.eql(roleName);
  //       doc.should.eql(savedDoc);
  //     });
  //   });
  //
  // });

});
