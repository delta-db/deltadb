'use strict';

var commonUtils = require('../../common-utils'),
  Client = require('../../../scripts/client/adapter'),
  Promise = require('bluebird'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('multiple', function () {

  var client1 = null,
    client2 = null,
    db1 = null,
    db2 = null,
    col1 = null,
    col2 = null,
    doc1 = null,
    doc2 = null;

  beforeEach(function () {
    client1 = new Client(true); // local only so no connection to server
    client2 = new Client(true); // local only so no connection to server

    db1 = client1.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });
    db2 = client2.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });
    col1 = db1.col('mycol');
    col2 = db2.col('mycol');
    doc1 = col1.doc();
    doc2 = col2.doc();
  });

  afterEach(function () {
    return Promise.all([db1.destroy(true), db2.destroy(true)]);
  });

  // Note: don't need afterEach as everything created in mem and therefore doesn't need to be purged

  it('should have unique event emitters', function () {

    // Note: the following test was failing with as Doc defined an attribute called "_events" which
    // was also in use by EventEmitter. TODO: to prevent this in the future, should Doc contain
    // EventEmitter and just provide access functions?

    var promiseFactory = function () {
      doc1.emit('test-event');
      return Promise.resolve();
    };

    return commonUtils.shouldDoAndNotOnce(promiseFactory, doc2, 'test-event');
  });

});
