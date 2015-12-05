Partitions
==========
1. QUEUED - pending changes
2. LATEST - the latest attribute values, including tombstones. (The client only needs the latest values).
3. ALL - all of the deltas
4. RECENT - the latest attribute values since the last archive. (The client only needs the latest values).


Process
==========

1. Get batch from QUEUED changes
2. If change is an update, checks LATEST to see if doc was deleted and if it was then auto restores doc by restoring LATEST, adding to RECENT and ALL.
3. Replaces LATEST or RECENT if update is later. Adds to ALL.
4. Remove batch from QUEUED changes


Archive
==========

1. Get current time
2. Remove from RECENT before time
3. Set archived to time in 1st step


Sync
==========

1. If server: (requires storing last syncd for each server)
   - if last syncd is before last archived then need to pull all changes from ALL with recorded_at after or on last syncd
   - if last syncd is after last archived then pull all changes from RECENT with recorded_at after or on last syncd
2. If client: (requires storing last syncd for each server)
   - if last syncd is before last archived then need to pull all changes from LATEST with recorded_at after or on last syncd
   - if last syncd is after last archived then pull all changes from RECENT with recorded_at after or on last syncd


Super Role
==========

Permissions can change at any time and there is no gurantee that any policy changes will happen before any other data changes. To avoid race conditions where servers could ignore changes when sufficient access is not yet been granted, we utilize a reserved $super role, which grants the $super user the ability to read or write any data. The $super role is managed just like any other role and therefore any number of server users can be added or removed.

The default super user's username, password and salt are defaulted to the System super user's username, password and salt. This way a db-per-user setup will yield a DB cluster where the same super user can be used to sync all the DBs.


Admin Role
==========

The $admin role is a role that is set up by default to allow privledged users to create or delete databases. Moreover, a default $admin user is also created and added to this role. Both the user and role can be completetly disabled and are only provided as a convenience to set up a default way of accessing these areas of the DB.


Switching Syncing Server
==========

Servers record changes at different times and therefore the client needs to to store the last synced timestamp for each server or if it doesn't have this timestamp, it needs to perform an "initial" sync. Switching syncing servers leads to the same changes being received twice, which is a waste of bandwidth. Therefore, it is preferrable for clients to stick with their primary syncing server.


Restore
==========

IGNORE IF NOT LATEST-NOT USED:
- a: creates Google { site: google.com }
- a: syncs
- b: deletes Google
- a: edits Google { site: gmail.com }
- a: syncs
- b: syncs => RESULT: delete ignored as a edited after b deleted

AUTO RESTORE-CHOSEN SOLUTION AS DOESN'T LEAD TO UNEXPECTEDLY DELETED DATA:
- a: creates Google { site: google.com }
- a: syncs
- b: syncs
- b: deletes Google
- a: edits Google { site: gmail.com }
- b: syncs
- a: syncs in 1 yr => restore doc and apply changes

Auto restore: after doc updated, check when doc was previously deleted and if the update was after the deletion date then auto restore

Future: how does auto restore work if a doc depends on another and both have been deleted? Probably need to define dependencies, i.e. foreign keys


Sequence Number
==========

Background: back-to-back writes can be made e.g. via
	doc.set('n', 1);
	doc.set('n', 2);
which can result in both n=1 and n=2 having the same timestamp as the timestamp is measured in milliseconds. To ensure that the second write wins, a local sequence number is used. This number is only considered relevant when the timestamps are exactly the same.

Other possible solutions:
a. Make define into a promise and then check if need to sleep for 1 millisecond before returning--same needs to be done for set? But what about the millisecond delay? Can this greatly slow down the code? would also make it impossible to then have api with calls like db.put(doc), like PouchDB, unless require use of promises
b. Is there a way to just use <= e.g. so that change overwrites previous change? Yes, but then the same logic has to persist on the server and this method is no longer deterministic as changes can appear "out of order"
c. Also store microseconds - problem is that microsecond timing is not available for all browsers - window.performance.now() - https://developer.mozilla.org/en-US/docs/Web/API/Performance.now. Furthermore, it is possible that faster computers in the future will be able to reproduce the same problem with identical microsecond timestamps
e. Make .set(), replace if timestamp matches - this then requires parsing through the entire list of local changes, which can get large if the client hasn't sync'd in a while


Data is eventually consistent (and deterministic)
==========

TSV (Timestamp Sequence Value) Conflict Resolution
1. Latest updated_at wins
2. If updated_at the same then highest seq wins
3. If updated_at the same and seq the same then highest value wins


Changes format
==========

Examples:

  Each record is a change - Choosing this for now as we want low load on the server so the structure should probably mimic the DB tables so that less processing has to be done
```js
  { object: 'task', userId: '123', name: 'attr1', value: 'v1', updatedAt: '2014-01-01 10:00' },
  { object: 'task', userId: '123', name: 'attr2', value: 'v2', updatedAt: '2014-01-01 10:00' },
  { object: 'task', name: 'attr3', value: 'v3', createdAt: '2014-01-02 10:00' },
  { object: 'task', name: 'attr4', value: 'v4', createdAt: '2014-01-02 10:00' },
  { object: 'task', name: 'oldattr', deletedAt: '2013-01-01 10:00' }
```

  Changes nested under object - prob is that userId, changedByUserId, etc... add more complex permutations
```js
  {
    object: 'task',
    changes: [
      {
        userId: '123',
        updatedAt: '2014-01-01 10:00',
        changes: { attr1: 'v1', attr2: 'v2' }
      },
      {
        createdAt: '2014-01-02 10:00',
        changes: { attr3: 'v3', attr4: 'v4' }
      },
      {
        deletedAt: '2013-01-01 10:00',
        changes: { oldattr: 'val' }
      }
    ]
  }
```

  Changes grouped:
```js
  {
    object: 'task',
    userId: '123',
    updatedAt: '2014-01-01 10:00',
    changes: { attr1: 'v1', attr2: 'v2' }
  },
  {
    object: 'task',
    createdAt: '2014-01-02 10:00',
    changes: { attr3: 'v3', attr4: 'v4' }
  },
  {
    object: 'task',
    deletedAt: '2013-01-01 10:00',
    changes: { oldattr: 'val' }
  }
```


Tombstones
==========

Tombstones must be stored in the client as different servers and clients may have different data and the client must use the tombstone to determine whether the update should be ignored, i.e. when the update is for data that has since been deleted. As such, deletions are not free so if an app wishes to delete a lot of data then it is best that the app reuse doc ids so that extra tombstones aren't created.

Without tombstones we cannot just diff our local docs with remote docs as changing from server to server could lead to unexpected doc deletions, e.g.
- Client sends { priority: 'high' } to ServerA
- Client syncs with ServerB (ServerB doesn't have doc) --> how could we determine that doc needs to remain if removing based on diff?


Threading
==========

Design is thread safe so can run any number of process(), archives(), changes(), etc... at once. This allows you to maximize usage of your CPU cores by running additional node processes.


Transactions
==========

DeltaDB avoids using transactions by instead qualifying all updates with a timestamp clause. This method still guarantees eventual consistency and keeps the database running quickly as transactions can block threads and require substantial overhead.


Permissions
==========

A UUID is used to identify the user. This is done so that 2 servers don't create the same user_id (an internal detail) when client1 registers with server1 and client2 registers with server2.

You need the update permission to "create" any attr values due to the fact that there can be multiple attrs per doc and the doc is created when the first change is processed.


Permission Race Conditions
==========
No changes are guaranteed to be received in any order so something like:
1. ClientA locks down MyRole
2. ClientA gives ThatUser access to MyRole
3. ClientB (ThatUser) makes a change to MyData that requires MyRole
If 3. happens before 2. then the change will fail. It is the client's responsibility to inform the user that they don't have access to MyData until they are added to MyRole. The client uses the "record" construct to guarantee that these changes have occurred.


DeltaDB Server Stack
==========
- DB            = interface to particular SQL DB, e.g. Postgres, MySQL, etc...
- SQL           = interface to any SQL DB
- Partitioner   = interface to partitions, i.e. Queue, Latest, Recent, Cached, All
- System        = interface to system info, e.g. main accounts for creating DBs
- Manager       = manages Partitoner
- Server        = web socket and RESTful API


Tombstone Window (TODO)
===
Another option is to have a per-doc configurable Tombstone Window where tombstones can be completely removed after X days and any changes older than X days will be ignored. Then assumes that clients sync in those X days.


Recycle Pattern
==========

Deletions are not free as tombstones are created. If deletions are common, docs can be reused. For example, each process could claim a number of tombstones with it's device-id--this prevents another device from using the same tombstone. Then existing docs that have been deleted are reused.

But... How can device claim the tombstone as two claims could happen at same time? Need some concept of rev #? And rev conflict? Rev # gen for each change and can choose conflict mode, ie choose to specify rev #. Rev at doc or attr level? Or maybe better construct to have something similar to rev # that doesn't need to be calculated per attr. Probably needs to be at attr and always sent with every attr from server. But how can this really be implemented when there is a cluster as two different clients can record changes with different servers!!

Probably better to just use Tombstone Window.


Reserved Names (TODO: needs updating)
==========

* Attr:
  * name:
    * $user = for editing user
    * $role = for adding/removing user role
    * $policy = for setting policy
    * $db = for creating DB
* Col:
  * name: TODO


User Roles
==========

Adding a user to a role requires access to the user and the role. To accomplish this we dynamically derive 2 changes from every user role modification, e.g.
```js
  { col: '$urole', name: '$urole', val: { action: 'add', roleUUID: 'ROLEUUID',
    userUUID: 'USERUUID' }
```
becomes:
```js
  { col: '$ruROLEUUID', name: '$urole', val: { action: 'add', roleUUID: 'ROLEUUID',
    userUUID: 'USERUUID' }
  { col: '$urUSERUUID', name: '$urole', val: { action: 'add', roleUUID: 'ROLEUUID',
    userUUID: 'USERUUID' }
```
Furthermore, we also need to do a lookup of the docUUID (via the user_roles table) based on the roleUUID and userUUID as otherwise:
1. We'd generate docUUIDs and require the app to know the docUUID when removing the user from the role
2. Or, we'd set docUUID = PREFIX + roleUUID + userUUID, which would make our docUUID twice as long!

When storing the doc_ids in user_roles, we only store the doc_id of the LATEST doc and use the docUUID to lookup the doc_ids for the other partitions.


Generator Deltas
==========

Some data like the $db collection is best managed w/o a doc uuid, i.e. you don't need to know the doc uuid to destroy a database. To accomplish this, we us generator deltas which use a value like { action: 'remove', name: 'my-db' } to look up the doc uuid and then create an additional delta to represent the actual change so that clients can be notified.

Generator deltas also allow the originating client to keep track of when the generator delta was "executed." For example, a client can listen for the recording of the generator delta used to create a DB as this recording is made after the DB has been created.


Data Loss
==========

When using at least 2 servers, DeltaDB guarantees that data is stored on 2 servers before reporting a successful write to the client. If the client doesn't receive confirmation of the write in X seconds then it will retry and keep retrying until a confirmation is received. In most demanding setups, the servers will be syncing with each other continuously which means that the possibility for data loss after the change has been recorded by 2 servers is very low. That being said, if 2 servers record the change and then both become immediately unrecoverable before syncing the change to another server in the cluster, data will be lost. Obviously, the likelihood of this happening is very low, e.g. if both were instantly wiped out due to a natural disaster. To mitigate this possibility, pairs of syncing servers could be located in different geographical regions.

We could better prevent this data loss, but this would greatly slow down the database and would increase complexity in the design, something that may be considered in the future. This would be done by registering each syncing server in a "servers" store and then maintaining a "recordings" store that would track when each server has recorded the change. The "recordings" store could then be used to determine whether to increment a counter in the "attributes" store that could be used to only report recordings to a client once the counter has reached X writes (a configurable quorum). This extra complexity would be needed as it is possible that a server could be interupted when recording another server's changes and then have to restart the recordings, which would then result in changes being recorded more than once for the same source server. Furthermore, the process of reading from the "recordings" store and setting the counter in the "attributes" store would require a row lock on the attribute so that another syncing thread doesn't update the counter out-of-sync with the "recordings" store. Row locking results in a much slower DB!

Another option is to use the queued log and sync the queued log file using some networked filesystem.


Misc
==========

- DOCS (only latest updated/deletion wins--everything else ignored):
  - updated_at: changed when attribute changes (including attribute deletion), not when doc deleted
  - deleted_at: changed when doc deleted, not when attribute deleted
- ATTRS:
  - updated_at: changed when attribute changes (including attribute deletion), not when doc deleted
  - deleted_at: TODO: remove and just consider lack of name and value and use updated_at for date?
