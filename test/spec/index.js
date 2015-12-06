'use strict';

var utils = require('../utils');

describe('spec', function () {

  this.timeout(utils.TIMEOUT);

  require('./adapter');
  require('./client');
  require('./db');
  require('./delta-db');
  require('./doc');
  require('./events');
  require('./multiple');
  require('./persist');
  require('./socket');
  require('./utils');
});
