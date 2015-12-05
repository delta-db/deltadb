'use strict';

var DBExistsError = function (message) {
  this.name = 'DBExistsError';
  this.message = message;
};

DBExistsError.prototype = Object.create(Error.prototype);
DBExistsError.prototype.constructor = DBExistsError;

module.exports = DBExistsError;
