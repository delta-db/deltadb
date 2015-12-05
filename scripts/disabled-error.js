'use strict';

var DeltaError = require('./delta-error'),
  inherits = require('inherits');

var DisabledError = function (message) {
  this.name = 'DisabledError';
  this.message = message;
};

inherits(DisabledError, DeltaError);

module.exports = DisabledError;
