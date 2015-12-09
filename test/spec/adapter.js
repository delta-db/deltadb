'use strict';

var Client = require('../../scripts/adapter');

describe('adapter', function () {

  var client = null,
    db1 = null;

  beforeEach(function () {
    client = new Client(true);

    db1 = client.db({
      db: 'mydb'
    });
  });

  afterEach(function () {
    return db1.destroy();
  });

  it('should reuse dbs', function () {
    var db2 = client.db({
      db: 'mydb'
    });
    db2.should.eql(db1);
  });

});
