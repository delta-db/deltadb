'use strict';

var utils = require('deltadb-common-utils');

var Utils = function () {};

Utils.prototype.STATUS_ENABLED = 'enabled'; // Also set here so that client doesn't need Users

Utils.prototype.genUser = function (userUUID, username, password, status) {
  // Include uuid in user so that can retrieve userUUIDs using deltas
  var user = {
    uuid: userUUID,
    username: username,
    status: status ? status : this.STATUS_ENABLED
  };
  return utils.genSaltAndHashPassword(password).then(function (saltAndPwd) {
    user.salt = saltAndPwd.salt;
    user.password = saltAndPwd.hash;
    return user;
  });
};

// Use a prefix so that user UUIDs don't conflict with UUIDs of other docs
Utils.prototype.UUID_PRE = '$u';

Utils.prototype.toDocUUID = function (userUUID) {
  // docUUID is derived from userUUID as we need to create user's dynamically when we first
  // encounter a change and need a way to reference that user later
  return this.UUID_PRE + userUUID;
};

Utils.prototype.NAME_PRE_USER_ROLES = '$ur';

Utils.prototype.ACTION_ADD = 'add';
Utils.prototype.ACTION_REMOVE = 'remove';

Utils.prototype.SYSTEM_DB_NAME = 'system';
Utils.prototype.DB_COLLECTION_NAME = '$db';
Utils.prototype.DB_ATTR_NAME = '$db'; // TODO: rename to ATTR_NAME_DB??

Utils.prototype.COL_NAME_ALL = '$all';

Utils.prototype.ATTR_NAME_ROLE = '$role';
Utils.prototype.ATTR_NAME_ROLE_USER = '$ruser';
Utils.prototype.ATTR_NAME_ACTION = '$action';

Utils.prototype.escapeDBName = function (dbName) {
  // Allow hyphens, but convert to underscores in case DB doesn't support hyphens
  var pat1 = new RegExp('-', 'g');
  dbName = dbName.replace(pat1, '_').toLowerCase();

  // Check for any invalid chars
  var pat3 = new RegExp('[^0-9a-z_]', 'gim');
  if (pat3.test(dbName)) {
    throw new Error('DB name [' + dbName + '] contains invalid chars');
  }
  return dbName;
};

module.exports = new Utils();
