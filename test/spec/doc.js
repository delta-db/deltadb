'use strict';

var Client = require('../../scripts/adapter'),
  Doc = require('../../scripts/doc'),
  MemAdapter = require('deltadb-orm-nosql/scripts/adapters/mem'),
  utils = require('deltadb-common-utils');

describe('doc', function () {

  var client = null,
    db = null,
    tasks = null,
    task = null;

  beforeEach(function () {
    client = new Client(true);

    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });

    tasks = db.col('tasks');

    task = tasks.doc();
  });

  afterEach(function () {
    return db.destroy(true);
  });

  var shouldSaveChange = function (data) {
    return task.set(data).then(function () {

      // Get the last change as we are using delete to delete the array items so the first index may
      // not be 0
      var change = task._dat.changes[task._dat.changes.length - 1];

      // Make sure value is being set
      if (data.thing === null) {
        (change.val === null).should.eql(true);
      } else {
        change.val.should.eql(data.thing);
      }

      // Simulate recording
      return task._saveChange({
        name: change.name,
        val: JSON.stringify(change.val),
        up: change.up.toISOString(),
        re: change.up.toISOString()
      }, false, true);
    }).then(function () {
      // Make sure change was removed
      utils.empty(task._dat.changes).should.eql(true);
    });
  };

  it('should save change', function () {
    return shouldSaveChange({
      thing: 'high'
    });
  });

  it('should save destroy change', function () {
    return shouldSaveChange({
      thing: 'high'
    }).then(function () {
      return task.destroy();
    }).then(function () {

      // Get the last change as we are using delete to delete the array items so the first index may
      // not be 0
      var change = task._dat.changes[task._dat.changes.length - 1];

      // Simulate recording of destroy
      return task._saveChange({
        name: change.name,
        up: change.up.toISOString(),
        re: change.up.toISOString()
      }, false, true);
    }).then(function () {
      // Make sure change was removed
      utils.empty(task._dat.changes).should.eql(true);
    });
  });

  it('should record when remote change has seq', function () {
    var updated = new Date();

    task._dat.changes = [{
      name: 'priority',
      val: 'high',
      up: updated,
      seq: 1
    }];

    task._record('priority', 'high', updated);
  });

  it('should set policy', function () {

    var policy = {
      col: {
        read: 'somerole'
      }
    };

    return task.policy(policy).then(function () {
      var doc = task.get();
      doc[Doc._policyName].should.eql(policy);
    });

  });

  it('should not format change', function () {
    // Exclude from changes when already sent
    var change = {
      sent: new Date()
    };
    var now = change.sent.getTime() - 1;
    task._formatChange(0, null, null, change, now);
  });

  it('should format false change', function () {
    var change = { // fake
      val: false,
      up: new Date()
    };

    var changes = [];

    task._formatChange(0, null, changes, change);

    changes[0].val.should.eql('false');
  });

  it('should get existing doc', function () {
    // Set task so that id is generated for future lookup
    return task.set({
      thing: 'sing'
    }).then(function () {
      var doc = tasks.doc(task.get());
      doc.should.eql(task);
    });
  });

  it('should save boolean change and record', function () {
    return shouldSaveChange({
      thing: false
    });
  });

  it('should save null change and record', function () {
    return shouldSaveChange({
      thing: null
    });
  });

  it('should load deleted at timestamp from store', function () {
    var now = new Date();

    // Fake store
    var store = {
      updatedAt: now,
      destroyedAt: now,
      recordedAt: now
    };

    task._loadTimestampsFromStore(store);

    // Make sure later timestamps from store
    task._dat.updatedAt.should.eql(now);
    task._dat.destroyedAt.should.eql(now);
    task._dat.recordedAt.should.eql(now);

  });

  it('should convert to iso string when truthy', function () {
    task._toISOStringIfTruthy(new Date('2015-11-17T04:11:38.620Z'))
      .should.eql('2015-11-17T04:11:38.620Z');
    (task._toISOStringIfTruthy(null) === null).should.eql(true);
  });

  it('should set even if contains id', function () {
    // The id may be present when we work with a copy of the doc's data
    return task.set({
      $id: task.id(),
      thing: 'sing'
    });
  });

});
