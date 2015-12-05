Contributing
====

Beginning Work on an Issue
---
	Create branch
	git clone branch-url


Committing Changes
---
[Commit Message Format](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#commit)

	npm run coverage
	npm run beautify
	git add -A
	git commit -m msg
	git push


Updating Dependencies
---
This requires having david installed globally, which is already handled by our vagrant setup.

	david update


Publishing to npm
---

	tin -v VERSION
	git add -A
	git commit -m 'VERSION'
	git tag vVERSION
	git push origin master --tags
	npm publish


Run all local tests
---

	npm run test


Run single node test
---

	node_modules/mocha/bin/mocha -g regex test


Run subset of tests and analyze coverage
---

	node_modules/istanbul/lib/cli.js cover _mocha -- -g regex test


Debugging Tests Using Node Inspector
---

	$ node-inspector # leave this running in this window
	Use *Chrome* to visit http://127.0.0.1:8080/?ws=127.0.0.1:8080&port=5858
	$ mocha -g regex test/index.js --debug-brk


Run tests in a browser
---

	$ npm run browser-server
	Use browser to visit http://127.0.0.1:8001/test/browser/index.html


Run Saucelabs Tests In a Specific Browser
---

	$ CLIENT="saucelabs:internet explorer:9" SAUCE_USERNAME=deltadb-user
	  SAUCE_ACCESS_KEY=f74addf5-f68b-4607-8005-6a1de33a3228 npm run browser-test
