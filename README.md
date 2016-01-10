<img src="https://raw.githubusercontent.com/delta-db/deltadb-server/master/deltadb.png" alt="DeltaDB" width="50" height="50" /> deltadb [![Build Status](https://travis-ci.org/delta-db/deltadb.svg)](https://travis-ci.org/delta-db/deltadb) [![Coverage Status](https://coveralls.io/repos/delta-db/deltadb/badge.svg?branch=master&service=github)](https://coveralls.io/github/delta-db/deltadb?branch=master) [![Dependency Status](https://david-dm.org/delta-db/deltadb.svg)](https://david-dm.org/delta-db/deltadb)
===
[![Selenium Test Status](https://saucelabs.com/browser-matrix/deltadb-user.svg)](https://saucelabs.com/u/deltadb-user)

DeltaDB is an offline-first database designed to talk directly to clients and works great offline and online.


Live Demos
---

* [todomvc-angular](http://delta-db.github.io/deltadb/examples/todomvc-angular) - a todo app. For fun, open it in 2 different browser windows and watch the todos change in the 2nd window when you change the todos in the 1st window.

* [hello](http://codepen.io/redgeoff/pen/vLKYzN?editors=100) - a simple hello world example with code


[Getting Started With DeltaDB](https://medium.com/@redgeoff/getting-started-with-deltadb-137359111282#.tciuz7o6b)
---

Check out the [Getting Started With DeltaDB](https://medium.com/@redgeoff/getting-started-with-deltadb-137359111282#.tciuz7o6b) tutorial


Main Principles
---

* Written in JavaScript
* Framework agnostic
* Works the same whether the client is offline or online
* NoSQL database that works in your browser and automatically syncs with the database cluster
* Stores all data as a series of deltas, which allows for smooth collaborative experiences even in frequently offline scenarios.
* Uses a simple last-write-wins conflict resolution policy and is eventually consistent
* Uses a homegrown ORM to speak to underlying SQL databases. (Support for underlying NoSQL databases will be added)
* Is fast. Clients push their deltas on to the server's queue. The server processes the queue separately and partitions the data so that clients can retrieve all recent changes very quickly.
* Implements a granular authentication system that protects databases, collections, docs and attributes
* Is incredibly scalable. Deltas can be segmented by UUID and the cost to add new nodes has a negligible impact on the cluster as handshaking between servers can be done as frequently as desired.
* Highly available. Clients can switch to talk to any node, even if that node hasn't received the latest deltas from another node.
* Fault tolerant by using the concept of a quorum of servers for recording changes
* Data is auto-restored when a client modifies data that was previously deleted
* Uses timestamps to update records so that transactions and their overhead can be avoided
* Thread-safe so that adding more cores will speed up DB reads and writes


Why?
---

Because it doesn't exist and true support for offline environments needs to be engineered from the ground up
- PouchDB relies on CouchDB and CouchDB is slow to replicate when there are many revisions and it is not optimized for offline setups like db-per-user
- Firebase doesn't work offline and is not open source
- Meteor doesn't work offline
- See [Inspiration](https://github.com/delta-db/deltadb-server/blob/master/INSPIRATION.md) for more info


[Installation](https://github.com/delta-db/deltadb-server/blob/master/INSTALL.md)
---


[Examples](EXAMPLES.md)
---


[API](https://github.com/delta-db/deltadb/wiki)
---


[To Do](https://github.com/delta-db/deltadb-server/blob/master/TODO.md)
---


[Contributing](CONTRIBUTING.md)
---


[Notes](https://github.com/delta-db/deltadb-server/blob/master/NOTES.md)
---


[Issues](https://github.com/delta-db/deltadb-server/blob/master/ISSUES.md)
---


[Ideas](https://github.com/delta-db/deltadb-server/blob/master/IDEAS.md)
---
