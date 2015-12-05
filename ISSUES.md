
Timstamp Skew
===

It is possible that a client's clock is not in sync with that of a server. This skew can result in deltas being created in an order that is not consistent with expectations. E.G. A client with a clock that is a year ahead will produce deltas that always replace any created by clients with a synced clock. There are several ways to address this:

1. **Adjust Timestamps** - we assume the server's clock is accurate. During connection, the server could send its current timestamp to the client. If the timestamp skew is large enough, the client modifies all pending changes to account for the skew and then creates any new changes with an "adjusted timestamp" as defined by the skew. This adjustment would also have to be considered whenever comparing the local time with any time in a delta. The downside here is that it takes a small amount of time, e.g. a sec to transmit the timestamp from the server and so the accuracy could vary, but we may be able to tighten this up by sending and receiving several messages sequentially to estimate hop duration. In the end, the accuracy is probably sufficient enough for most applications.

2. Ignore Future Deltas - we assume the server's clock is accurate. If the server receives a delta with an updated timestamp that is after the current time then we ignore the delta. This in effect would cause the client to resend the delta. The downside is that it would require the app developer to alert the user accordingly (something that may be OK). The other downside is that tiny clock skews (probably fairly common) could result in large delays in recording as the client doesn't immediately resend the delta. This can be solved however by making it so that we implement a window where the server keeps deltas that are in the future, but within the window, and just sits on them until it is ready to process the deltas. The downside is that the order of changes during this window are not guaranteed. But, do we really care? E.G.
- Scenario: ClientA's clock is 1 min ahead, ClientB's clock is in sync, the "window" is 1 min
- ClientB: makes a change and syncs
- Afterwards, ClientA: makes a change and syncs
- Server processes ClientB's change after sitting on it and considers it ahead of ClientA even though happened before when observed in logical global time

3. Warning - during connection, the server could compare its timestamp with one that is sent from the client. If the skew is large enough, the server could send a warning message to the client to help app developers alert users that they should change their clocks. This may be helpful when used in conjunction with another solution.



Policies and Data Consistency
===

This may not be an issue and if it isn't then this should be moved to NOTES.md. Depending on the order in which policy changes/users edits are received it is possible for data to be recorded in non-deterministic ways. The servers should have super user permissions so that they can sync all changes and ensure eventual consistency. Could this ever be avoided?
