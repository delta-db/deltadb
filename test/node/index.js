'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should();

// NOTE: auto-adapter-store uses IndexedDB when available. The IndexedDB adapter is tested at the
// deletadb-orm-nosql layer, but to be extra safe we also test it at this layer as IndexedDB is very
// delicate.
require('../../scripts/auto-adapter-store');

require('../spec');
