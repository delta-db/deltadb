'use strict';

var DBMissingError = function (message) {
  this.name = 'DBMissingError';
  this.message = message;
};

DBMissingError.prototype = Object.create(Error.prototype);
DBMissingError.prototype.constructor = DBMissingError;

module.exports = DBMissingError;
