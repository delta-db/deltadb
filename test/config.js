'use strict';

var Config = function () {};

// Set config so that our test server doesn't interfere with any production server
Config.prototype.PORT = 8081;

Config.prototype.DB_NAME_PREFIX = 'delta_test_db_';

Config.prototype.SYSTEM_DB_NAME_PREFIX = 'delta_test_sys_';

// TODO: can we change this to https?
Config.prototype.URL = 'http://localhost:' + Config.prototype.PORT;

module.exports = new Config();
