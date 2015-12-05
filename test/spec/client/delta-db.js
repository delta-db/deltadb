'use strict';

var DeltaDB = require('../../../scripts/client/delta-db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('delta-db', function () {

  it('should create and destroy locally only', function () {
    var db = new DeltaDB('mydb');
    return db.destroy(true);
  });

  it('should uuid', function () {
    var uuid = DeltaDB.uuid();
    (uuid !== null).should.eql(true);
  });

  it('should construct with store', function () {
    var adapter = new MemAdapter();
    var dbStore = adapter.db('mydb');
    var db = new DeltaDB('mydb', null, null, null, dbStore);
    return db.destroy(true);
  });

});
