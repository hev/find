---
title: "Guarantees"
description: "This document serves as a brief reference of turbopuffer's guarantees:"
group: "Concepts"
---

This document serves as a brief reference of turbopuffer's guarantees:

* **Durable Writes.** Writes are committed to object storage upon successful return by turbopuffer's API.
* **Consistent Reads.** Queries return the latest data by default but can be [configured](/docs/query)
for performance at the cost of read consistency. Most updates are visible immediately since
queries usually hit the writing node. [Over 99.8% of queries return consistent data](/docs/query#param-consistency),
however staleness of about 100ms can be observed during (rare) scaling/failover operations, and staleness of up to about one hour can be observed after significant writes. Specifically, once a namespace has more than 128MiB of outstanding writes, further writes are not visible until they are indexed and loaded into cache. For small namespaces indexing and cache warming takes tens of seconds; for large namespaces this process can take tens of minutes.

* **Atomic Conditional Writes.**  [Conditional writes](/docs/write#conditional-writes) evaluate their condition atomically with writing.
* **Atomic Batches.**  All writes in an upsert are applied simultaneously.
* **Branch isolation.** Branched namespaces are point-in-time snapshots that are fully independent after creation. Writes to one namespace are never visible in the other. Deleting either namespace does not affect the other.
* **Any node can serve queries for any namespace.** HA does not come as a cost/reliability trade-off. Our HA is the number of query nodes we run.
* **Object storage is the only stateful dependency.** This means there is no separate consensus plane that needs to be maintained and scaled independently, simplifying the system's operations and thus reliability. All concurrency control is delegated to object storage.
* **Compute-Compute Separation.** Query nodes handle queries and writes to object storage and the write-through cache. All expensive computation happens on separate, auto-scaled indexing nodes.
* **Smart Caching.** After a cold query, data is cached on NVMe SSD and frequently accessed namespaces are stored in memory. turbopuffer does not need to load the entire namespace into cache, and then query it. The storage engine is designed to perform small, ranged reads directly to object storage for fast cold queries. [Cache warming hints](/docs/warm-cache) can eliminate user-visible cold query latency in many applications.
* **Autoscaling.** Query and indexing nodes are automatically scale with demand.

Regarding ACID properties: turbopuffer provides Atomicity, Consistency, and
Durability.

Isolation is not broadly applicable, as general purpose read-write transactions
are not supported. However, limited read-write semantics are available through
[conditional writes](/docs/write#conditional-writes),
[`patch_by_filter`](/docs/write#patch-by-filter), and
[`delete_by_filter`](/docs/write#delete-by-filter).

Conditional writes evaluate their reads and writes atomically. This prevents
concurrency anomalies such as Lost Updates and ensures they behave as if run
under Serializable isolation, the strongest isolation level.

`patch_by_filter` and `delete_by_filter` execute in two phases:

1. They evaluate their filter against a namespace snapshot to identify matching
   document IDs.
2. They atomically re-evaluate their filter against those matching IDs and
   modify documents that still satisfy the condition.

Re-evaluation ensures that documents are never modified that no longer satisfy
the condition. However, newly qualifying documents that were inserted or updated
between the two phases will be missed. As a result, `patch_by_filter` and
`delete_by_filter` behave as if run under Read Committed isolation, similar to
`UPDATE ... SET ... WHERE ...` and `DELETE FROM ... WHERE ...` in
[PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED).

For CAP theorem: turbopuffer prioritizes consistency over availability when
object storage is unreachable. You can adjust this to favor availability through
[query configuration](/docs/query).

For more details, see [Tradeoffs](/docs/tradeoffs), [Limits](/docs/limits),
and [Architecture](/docs/architecture).
