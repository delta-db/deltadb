#!/usr/bin/env node

'use strict';

var HTTP_PORT = 8001;

var http_server = require('http-server');
var fs = require('fs');
var indexfile = './test/browser/index.js';
var dotfile = './test/browser/.bundle.js';
var outfile = './test/browser/bundle.js';
var watchify = require('watchify');
var browserify = require('browserify');

// TODO: make this configurable via an env var
// Watchify appears to occasionally cause "Error: watch ENOSPC" errors in saucelabs so we'll just
// disable it.
var useWatchify = false;

var b = browserify(indexfile, {
  cache: {},
  packageCache: {},
  fullPaths: true,
  debug: true
});

var filesWritten = false;
var serverStarted = false;
var readyCallback;

function bundle() {
  var wb = (useWatchify ? w.bundle() : b.bundle());
  wb.on('error', function (err) {
    console.error(String(err));
  });
  wb.on('end', end);
  wb.pipe(fs.createWriteStream(dotfile));

  function end() {
    fs.rename(dotfile, outfile, function (err) {
      if (err) {
        return console.error(err);
      }
      console.log('Updated:', outfile);
      filesWritten = true;
      checkReady();
    });
  }
}

if (useWatchify) {
  var w = watchify(b);
  w.on('update', bundle);
}

bundle();

function startServers(callback) {
  readyCallback = callback;
  http_server.createServer().listen(HTTP_PORT);
  console.log('Tests: http://127.0.0.1:' + HTTP_PORT + '/test/browser/index.html');
  serverStarted = true;
  checkReady();
}

function checkReady() {
  if (filesWritten && serverStarted && readyCallback) {
    readyCallback();
  }
}

if (require.main === module) {
  startServers();
} else {
  module.exports.start = startServers;
}
