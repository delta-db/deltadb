'use strict';

var utils = require('../../../scripts/utils'),
  Client = require('../../../scripts/client/adapter'),
  Promise = require('bluebird'),
  commonUtils = require('../../common-utils');

describe('persist', function () {

  var client = null,
    db = null,
    tasks = null,
    propsReady = null,
    db2 = null;

  beforeEach(function () {
    client = new Client(true);
    db = client.db({
      db: 'mydb'
    });
    propsReady = utils.once(db, 'load');
    tasks = db.col('tasks');
  });

  afterEach(function () {
    return Promise.all([db.destroy(true), db2 ? db2.destroy(true) : null]);
  });

  it('should restore from store', function () {

    var client2 = null,
      found = false,
      task = tasks.doc(),
      dbLoaded = utils.once(db, 'load');

    var nowStr = (new Date().toISOString());

    return task.set({
      thing: 'sing',
      priority: 'high'
    }).then(function () {
      // Wait until all the data has been loaded from the store
      return dbLoaded;
    }).then(function () {
      // Fake update of since
      return db._props.set({
        since: nowStr
      });
    }).then(function () {
      // Simulate a reload from store, e.g. when an app restarts, by destroying the DB, but keeping
      // the local store and then reloading the store
      return db.destroy(true, true);
    }).then(function () {
      client2 = new Client(true);
      db2 = client2.db({
        db: 'mydb'
      });

      // Wait until all the docs have been loaded from the store
      return utils.once(db2, 'load');
    }).then(function () {
      // Verify restoration of since
      var props = db2._props.get();
      props.since.should.eql(nowStr);

      // Verify task was loaded
      db2.all(function (tasks) {
        // Assuming only col is tasks
        tasks.find(null, function (task2) {
          // Check that all data, e.g. changes, latest, etc... was reloaded, not just the values
          task2._dat.should.eql(task._dat);
          found = true;
        }, true); // include destroyed docs
      });

      found.should.eql(true);
      return null; // prevent runaway promise warning
    });
  });

  it('should handle race conditions', function () {
    // Make sure there are no race conditions with loading, e.g.
    //   planner = client.db('planner');
    //   tasks = planner.col('tasks');
    //   write = tasks.doc({ thing: 'write' });
    // What if thing is already in the store and loads after we have the handles above?

    var task = tasks.doc({
        thing: 'sing',
        priority: 'high',
        notes: 'some notes'
      }),
      client2 = null,
      tasks2 = null,
      task2 = null;

    var setUpClient2 = function () {
      client2 = new Client(true);
      db2 = client2.db({
        db: 'mydb'
      });
      tasks2 = db2.col('tasks');
      task2 = tasks2.doc({
        $id: task.id(),
        thing: 'write',
        type: 'personal'
      });
      task2.unset('notes');
    };

    // Populate underlying store
    return task.save().then(function () {
      // Sleep so that timestamps aren't the same and the 2nd set of changes come later
      return commonUtils.sleep();
    }).then(function () {
      // Simulate reload using a second client
      setUpClient2();
      return utils.once(db2, 'load');
    }).then(function () {
      // Make sure that we take the latest changes
      task2.get().should.eql({
        $id: task.id(),
        thing: 'write',
        type: 'personal',
        priority: 'high'
      });
    });

  });

});
