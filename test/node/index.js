'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should();

// NOTE: auto-adapter-store uses IndexedDB when available. The IndexedDB adapter is tested at the
// deletadb-orm-nosql layer, but to be extra safe we also test it at this layer as IndexedDB is very
// delicate.
require('../../scripts/auto-adapter-store');

// Set config so that our test server doesn't interfere with any production server. We need to set
// the config first so that all of the following code uses this config.
var config = require('../../scripts/config'),
  testConfig = require('../config');
for (var i in testConfig) {
  config[i] = testConfig[i];
}

require('../spec');
