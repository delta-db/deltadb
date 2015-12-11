#!/bin/bash

# Make sure deps are up to date
# rm -r node_modules
# npm install

# get current version
VERSION=$(node --eval "console.log(require('./package.json').version);")

# Increment the version in master
git add -A
git commit -m "$VERSION"
git push origin master

# Build
git checkout -b build

npm run build

# Publish npm release
npm publish

# Create git tag, which is also the Bower/Github release
git add dist -f
# git add bower.json component.json package.json lib/version-browser.js
git rm -r bin scripts test

git commit -m "build $VERSION"

# Tag and push
git tag $VERSION
# TODO: can the following line be changed to git push origin master --tags $VERSION ??
git push --tags https://github.com/delta-db/deltadb.git $VERSION

# Cleanup
git checkout master
git branch -D build
