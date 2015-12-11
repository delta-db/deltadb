'use strict';

var inherits = require('inherits'),
  ParentLog = require('deltadb-common-utils/scripts/log');

var Log = function () {
  ParentLog.apply(this, arguments);
};

inherits(Log, ParentLog);

module.exports = new Log();
