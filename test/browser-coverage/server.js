#!/usr/bin/env node

'use strict';

var HTTP_PORT = 8001;
var http_server = require("http-server");

http_server.createServer().listen(HTTP_PORT);
console.log('Tests: http://127.0.0.1:' + HTTP_PORT + '/test/browser-coverage/index.html');
