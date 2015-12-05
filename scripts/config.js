'use strict';

var Config = function () {};

Config.prototype.PORT = 8080;

Config.prototype.DB_NAME_PREFIX = 'delta_db_';

Config.prototype.SYSTEM_DB_NAME_PREFIX = 'delta_sys_';

// TODO: can we change this to https?
Config.prototype.URL = 'http://localhost:' + Config.prototype.PORT;

module.exports = new Config();
