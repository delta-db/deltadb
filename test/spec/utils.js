'use strict';

var clientUtils = require('../../scripts/utils'),
  commonUtils = require('deltadb-common-utils'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils');

describe('utils', function () {

  var shouldGenUser = function (status) {
    return clientUtils.genUser('user-uuid', 'username', 'secret', status).then(function (user) {
      user.uuid.should.eql('user-uuid');
      user.username.should.eql('username');

      if (typeof status === 'undefined') {
        user.status.should.eql('enabled');
      } else {
        user.status.should.eql(status);
      }

      (user.salt === null).should.eql(false);
      (user.password === null).should.eql(false);
    });
  };

  it('should gen user without status', function () {
    return shouldGenUser();
  });

  it('should gen user with status', function () {
    return shouldGenUser(true);
  });

  it('should convert to doc uuid', function () {
    var docUUID = clientUtils.toDocUUID('user-uuid');
    docUUID.should.eql(clientUtils.UUID_PRE + 'user-uuid');
  });

  it('should sleep', function () {
    var before = new Date();
    return commonUtils.timeout(1000).then(function () {
      var after = new Date();
      var elapsed = after.getTime() - before.getTime();
      (elapsed >= 1000 && elapsed < 1500).should.eql(true); // allow for 500 ms window
    });
  });

  it('should throw when db name is invalid', function () {
    return commonTestUtils.shouldNonPromiseThrow(function () {
      clientUtils.escapeDBName('my^#invalid$ db%name!');
    }, new Error());
  });

});
