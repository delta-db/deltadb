'use strict';

var Sender = require('../../scripts/sender'),
  Promise = require('bluebird');

describe('sender', function () {

  it('should launch retry sender', function () {
    var db = { // fake
      _retryAfterMSecs: 10
    };

    var sends = 0,
      expectedSends = 2;

    var sender = new Sender(db);

    // The test will timeout if something goes wrong
    return new Promise(function (resolve) {
      sender.send = function () { // fake
        if (++sends === expectedSends) {
          resolve();
        }
      };
    });

  });

});
