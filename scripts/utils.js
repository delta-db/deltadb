'use strict';

// TODO: move all code needed by client from ../utils to client/utils

var Promise = require('bluebird'),
  bcrypt = require('bcryptjs');

var Utils = function () {
  this._bcrypt = bcrypt; // only for unit testing
};

Utils.prototype.STATUS_ENABLED = 'enabled'; // Also set here so that client doesn't need Users

Utils.prototype.hash = function (password, salt) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._bcrypt.hash(password, salt, function (err, hash) {
      if (err) {
        reject(err);
      }
      resolve(hash);
    });
  });
};

Utils.prototype.genSalt = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._bcrypt.genSalt(10, function (err, salt) {
      if (err) {
        reject(err);
      }
      resolve(salt);
    });
  });
};

Utils.prototype.hashPassword = function (password, salt) {
  return this.hash(password, salt).then(function (hash) {
    return {
      salt: salt,
      hash: hash
    };
  });
};

Utils.prototype.genSaltAndHashPassword = function (password) {
  var self = this;
  return self.genSalt(10).then(function (salt) {
    return self.hashPassword(password, salt);
  });
};

Utils.prototype.genUser = function (userUUID, username, password, status) {
  // Include uuid in user so that can retrieve userUUIDs using deltas
  var user = {
    uuid: userUUID,
    username: username,
    status: status ? status : this.STATUS_ENABLED
  };
  return this.genSaltAndHashPassword(password).then(function (saltAndPwd) {
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

Utils.prototype.timeout = function (ms) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, ms);
  });
};

// Executes promise and then resolves after event emitted once
Utils.prototype.doAndOnce = function (promise, emitter, evnt) {
  var once = this.once(emitter, evnt);
  return promise().then(function () {
    return once;
  });
};

Utils.prototype.once = function (emitter, evnt) {
  return new Promise(function (resolve) {
    emitter.once(evnt, function () {
      resolve(arguments);
    });
  });
};

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
