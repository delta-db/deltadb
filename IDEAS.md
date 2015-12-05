
Grouping?
---
```js
db.queue([ obj: 'task', doc: { $id: '123', thing: 'write a song', priority: 'medium' },
           up: '2014-01-01 10:00'],
         [ obj: 'task', doc: { $id: '123', priority: 'high' }, up: '2014-01-01 10:02']);
```

Good for Logging
---

Consider a single attr per log and using the purge history function to "rotate" logs.
