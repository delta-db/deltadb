#!/usr/bin/env node

'use strict';

var wd = require('wd');
var sauceConnectLauncher = require('sauce-connect-launcher');
var selenium = require('selenium-standalone');
var querystring = require('querystring');
var SauceResultsUpdater = require('./sauce-results-updater');

var server = require('./server.js');

var testTimeout = 30 * 60 * 1000;

var retries = 0;
var MAX_RETRIES = 10;
var MS_BEFORE_RETRY = 60000;

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;

var sauceResultsUpdater = new SauceResultsUpdater(username, accessKey);

// process.env.CLIENT is a colon seperated list of
// (saucelabs|selenium):browserName:browserVerion:platform
var clientStr = process.env.CLIENT || 'selenium:phantomjs';
var tmp = clientStr.split(':');
var client = {
  runner: tmp[0] || 'selenium',
  browser: tmp[1] || 'phantomjs',
  version: tmp[2] || null, // Latest
  platform: tmp[3] || null
};

var testUrl = 'http://127.0.0.1:8001/test/browser/index.html';
var qs = {};

var sauceClient;
var sauceConnectProcess;
var tunnelId = process.env.TRAVIS_JOB_NUMBER || 'tunnel-' + Date.now();

var jobName = tunnelId + '-' + clientStr;

var build = (process.env.TRAVIS_COMMIT ? process.env.TRAVIS_COMMIT : Date.now());

if (client.runner === 'saucelabs') {
  qs.saucelabs = true;
}

if (process.env.GREP) {
  qs.grep = process.env.GREP;
}

if (process.env.NOINDEXEDDB) {
  qs.noindexeddb = process.env.NOINDEXEDDB;
}

testUrl += '?';
testUrl += querystring.stringify(qs);

function testError(e) {
  console.error(e);
  console.error('Doh, tests failed');
  sauceClient.quit();
  process.exit(3);
}

function postResult(result) {
  var failed = !process.env.PERF && result.failed;
  if (client.runner === 'saucelabs') {
    sauceResultsUpdater.setPassed(jobName, build, !failed).then(function () {
      process.exit(failed ? 1 : 0);
    });
  } else {
    process.exit(failed ? 1 : 0);
  }
}

function testComplete(result) {
  sauceClient.quit().then(function () {
    if (sauceConnectProcess) {
      sauceConnectProcess.close(function () {
        postResult(result);
      });
    } else {
      postResult(result);
    }
  });
}

function startSelenium(callback) {
  // Start selenium
  var opts = {
    version: '2.45.0'
  };
  selenium.install(opts, function (err) {
    if (err) {
      console.error('Failed to install selenium');
      process.exit(1);
    }
    selenium.start(opts, function ( /* err, server */ ) {
      sauceClient = wd.promiseChainRemote();
      callback();
    });
  });
}

function startSauceConnect(callback) {

  var options = {
    username: username,
    accessKey: accessKey,
    tunnelIdentifier: tunnelId
  };

  sauceConnectLauncher(options, function (err, _sauceConnectProcess) {
    if (err) {
      console.error('Failed to connect to saucelabs, err=', err);

      if (++retries > MAX_RETRIES) {
        console.log('Max retries reached, exiting');
        process.exit(1);
      } else {
        console.log('Retry', retries, '...');
        setTimeout(function () {
          startSauceConnect(callback);
        }, MS_BEFORE_RETRY);
      }

    } else {
      sauceConnectProcess = _sauceConnectProcess;
      sauceClient = wd.promiseChainRemote('localhost', 4445, username, accessKey);
      callback();
    }
  });
}

function startTest() {

  console.log('Starting', client);

  var opts = {
    browserName: client.browser,
    version: client.version,
    platform: client.platform,
    tunnelTimeout: testTimeout,
    name: jobName,
    'max-duration': 60 * 30,
    'command-timeout': 599,
    'idle-timeout': 599,
    'tunnel-identifier': tunnelId
  };

  sauceClient.init(opts).get(testUrl, function () {

    /* jshint evil: true */
    var interval = setInterval(function () {

      sauceClient.eval('window.results', function (err, results) {

        console.log('=> ', results);

        if (err) {
          clearInterval(interval);
          testError(err);
        } else if (results.completed || results.failures.length) {
          clearInterval(interval);
          testComplete(results);
        }

      });
    }, 10 * 1000);
  });
}

server.start(function () {
  if (client.runner === 'saucelabs') {
    startSauceConnect(startTest);
  } else {
    startSelenium(startTest);
  }
});
