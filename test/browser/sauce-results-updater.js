// TODO: Is this really the best way to update the sauce lab job with the build and test status? If
// so, then this should be made into a separate GH repo.

'use strict';

var request = require('request'),
  SauceLabs = require('saucelabs'),
  Promise = require('bluebird');

var Sauce = function (username, accessKey) {
  this._username = username;
  this._sauceLabs = new SauceLabs({
    username: username,
    password: accessKey
  });
};

Sauce.prototype.findJob = function (jobName) {
  // NOTE: it appears that there is no way to retrieve the job id when launching a test via the
  // sauce-connect-launcher package. Therefore, we will use the sauce API to look up the job id. The
  // saucelabs package doesn't support the full option for getJobs and we don't want to have to make
  // an API call for each job to determine whether the job name matches so we will execute this GET
  // request manually.
  var self = this;
  return new Promise(function (resolve, reject) {
    var url = 'https://saucelabs.com/rest/v1/' + self._username + '/jobs?full=true';
    request(url, function (err, res, body) {
      if (err) {
        reject(err);
      } else {
        var jobs = JSON.parse(body);
        jobs.forEach(function (job) {
          if (job.name === jobName) { // matching job name?
            resolve(job);
          }
        });
      }
    });
  });
};

Sauce.prototype.updateJob = function (id, data) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._sauceLabs.updateJob(id, data, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

Sauce.prototype.setPassed = function (jobName, build, passed) {
  var self = this;
  return self.findJob(jobName).then(function (job) {
    return self.updateJob(job.id, {
      build: build,
      passed: passed
    });
  });
};

module.exports = Sauce;
