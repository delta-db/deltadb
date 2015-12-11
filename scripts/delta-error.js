'use strict';

var DeltaError = function (message) {
  this.name = 'DeltaError';
  this.message = message;
};

DeltaError.prototype = Object.create(Error.prototype);
DeltaError.prototype.constructor = DeltaError;

module.exports = DeltaError;
