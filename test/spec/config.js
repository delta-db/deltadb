'use strict';

var config = require('../../scripts/config');

describe('config', function () {

  it('should build url when port is missing', function () {
    config.vals.url.port = null;
    (config.url() === null).should.eql(false);
  });

});
