'use strict';

var DeltaError = require('./delta-error'),
  inherits = require('inherits');

var AuthenticationError = function (message) {
  this.name = 'AuthenticationError';
  this.message = message;
};

inherits(AuthenticationError, DeltaError);

module.exports = AuthenticationError;
