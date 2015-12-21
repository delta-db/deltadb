'use strict';

var vals = require('./config.json');

var Config = function () {
  this.vals = vals;
};

Config.prototype.url = function () {
  var url = this.vals.url;
  return url.scheme + '://' + url.host + (url.port ? ':' + url.port : '');
};

module.exports = new Config();
