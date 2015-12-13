'use strict';

var commonUtils = require('deltadb-common-utils');

var Utils = function () {};

// Long timeout needed for saucelabs tests
Utils.prototype.TIMEOUT = 20000;

Utils.prototype.sleep = function (sleepMs) {
  // Ensure a different timestamp will be generated after this function resolves.
  // Occasionally, using timeout(1) will not guarantee a different timestamp, e.g.:
  //   1. (new Date()).getTime()
  //   2. timeout(1)
  //   3. (new Date()).getTime()
  // It is not clear as to what causes this but the solution is to sleep longer. This function is
  // also used to delay between DB writes to create predictable patterns. In this case it may be
  // that the DB adapter processes queries out of sequence.
  return commonUtils.timeout(sleepMs ? sleepMs : 10);
};

Utils.prototype.allShouldEql = function (collection, expected) {
  // Index data as order is guaranteed

  var allDocs = {};

  var allExpDocs = {};
  expected.forEach(function (exp) {
    allExpDocs[exp.$id] = exp;
  });

  return collection.all(function (item) {
    allDocs[item.id()] = item.get();
  }).then(function () {
    allDocs.should.eql(allExpDocs);
  });
};

module.exports = new Utils();
