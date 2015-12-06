'use strict';

var DB = require('../../../scripts/db'),
  Client = require('../../../scripts/adapter'),
  commonUtils = require('deltadb-common-utils'),
  MockSocket = require('./mock-socket');

describe('with-socket', function () {

  var db = null,
    client = null;

  afterEach(function () {
    if (db) {
      return db.destroy();
    }
  });

  var createClientAndDB = function (opts) {
    DB._SocketClass = MockSocket;

    client = new Client();

    var allOpts = {
      db: 'mydb'
    };

    if (opts) {
      allOpts = commonUtils.merge(allOpts, opts);
    }

    db = client.db(allOpts);
  };

  it('should connect', function () {
    createClientAndDB();
  });

});
