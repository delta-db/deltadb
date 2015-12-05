'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

var utils = require('../utils');

describe('browser', function () {

  this.timeout(utils.TIMEOUT_MS);

  require('../spec');
  require('../spec/adapters/browser');

});
