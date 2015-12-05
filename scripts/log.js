'use strict';

var inherits = require('inherits'),
  ParentLog = require('../utils/log');

var Log = function () {
  ParentLog.apply(this, arguments);
};

inherits(Log, ParentLog);

module.exports = new Log();
