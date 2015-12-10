Wish List
---

- Create local storage adapter at deltadb-orm-nosql level so that we have persistence even when the browser doesn't support IndexedDB or WebSQL? Currently, the MemAdapter is used when there is no IndexedDB/WebSQL support. Or, just assume that since all new browsers have IndexedDB/WebSQL support that the days of needing to support these older browsers are very limited? http://caniuse.com/#search=localstorage
