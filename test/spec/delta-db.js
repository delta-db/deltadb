'use strict';

var DeltaDB = require('../../scripts/delta-db'),
  MemAdapter = require('deltadb-orm-nosql/scripts/adapters/mem'),
  MockSocket = require('./db/mock-socket'),
  DB = require('../../scripts/db');

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

  it('should create with url', function () {
    DB._SocketClass = MockSocket; // mock socket
    var db = new DeltaDB('mydb', 'https://example.com');
    return db.destroy(true);
  });

});
