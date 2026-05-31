---
title: "Limits"
description: "There isn't a limit or performance metric we can't improve by an order of magnitude when prioritized. If you expect to brush up against a limit or you"
group: "Concepts"
---

There isn't a limit or performance metric we can't improve by an order of
magnitude when prioritized. If you expect to brush up against a limit or you
are limited by present performance, [contact us](/contact).

| Metric | Observed in production | Production limits (current) |
| --- | --- | --- |
| Max documents (global) | 4T+ @ 15PB+ | Unlimited[^limits-note-1] |
| Max documents (queried simultaneously) | [100B+ @ 10TB](/blog/ann-v3) | Unlimited[^limits-note-2] |
| Max documents (per namespace) | 500M+ @ 2TB | 500M @ 2TB[^limits-note-3] |
| Max number of namespaces | 250M+ | Unlimited[^limits-note-4] |
| Max number of [pinned namespaces](/docs/pinning) | 256 | Contact us for custom |
| Max vector columns per namespace[^limits-note-5] |  | 2 |
| Max dimensions for dense vectors |  | 10,752 |
| Max total dimensions for sparse vectors | 30,522 | Unlimited |
| Max dimensions per sparse vector |  | 1,024 |
| Max inactive time in cache | hours[^limits-note-6] | Contact us for custom |
| Max write throughput (global) | 10M+ writes/s @ 32GB/s | Unlimited[^limits-note-7] |
| Max write throughput (per namespace) | 32k+ writes/s @ 64MB/s[^limits-note-8] | 10k writes/s @ 32 MB/s |
| Max namespace copy throughput[^limits-note-9] | 72 MB/s | Contact us if bottlenecked |
| Number of branches[^limits-note-10] | 1M+ | Unlimited |
| Max upsert batch request size |  | 512 MB |
| Max rows affected by [patch by filter](/docs/write#patch-by-filter) |  | 50k[^limits-note-11] |
| Max rows affected by [delete by filter](/docs/write#delete-by-filter) |  | 5M[^limits-note-12] |
| Max ingested, unindexed data[^limits-note-13] |  | 2 GB |
| Max queries (global) | 25k+ queries/s | Unlimited[^limits-note-14] |
| Max queries (per namespace)[^limits-note-15] | 1k+ queries/s | 1k+ queries/s |
| Max queries in a [multi-query request](/docs/query#param-queries) |  | 16 |
| Max concurrent queries per namespace[^limits-note-16] |  | 16 (100s of queries/s) |
| Max read replicas[^limits-note-17] | 3 | Unlimited |
| Vector search recall@10[^limits-note-18] | 90-100% | 90-100% |
| Max attribute value size[^limits-note-19] |  | 8 MiB |
| Max filterable value size[^limits-note-20] |  | 4 KiB |
| Max document size |  | 64 MiB |
| Max id size |  | 64 bytes |
| Max attribute name length[^limits-note-21] |  | 128 bytes |
| Max attribute names per namespace |  | 1,024 |
| Max namespace name length[^limits-note-22] |  | 128 bytes |
| Max full-text query length | 8,192 | 1,024 |
| Max [limit.total](/docs/query#param-limit) | 10k | 10k |
| Max aggregation groups per query | 10k | 10k |

[^limits-note-1]: Per namespace limits still apply, but due to the extreme scalability of object storage, we don't see any problems storing trillions of documents across billions of namespaces.
[^limits-note-2]: Requires manually sharding into multiple namespaces (e.g. id % N) to comply with per-namespace limits. Each namespace is limited to 2TB.
[^limits-note-3]: The byte size limit is enforced - writes to namespaces exceeding this size will be rejected. The document count limit is a soft limit; performance depends on query complexity.
[^limits-note-4]: Each namespace is simply a prefix on object storage, which means it scales to virtually unlimited as object storage providers don't specify a limit. [Architecture](/docs/architecture) for more details
[^limits-note-5]: The number of vector columns is fixed at namespace creation time and cannot be changed. Eventually up to 128.
[^limits-note-6]: This is simply the current production average cache SSD expiry time. We are currently over-provisioned in cache capacity. In the future, this may change slightly as we optimize the economies of scale. However, consider that our incentive is aligned with yours to keep the cache intelligent, as using object storage for hot reads is expensive.
[^limits-note-7]: Writes are processed through a cluster of horizontally scaleable turbopuffer Rust binaries. They write directly to object storage, which scales to virtually unlimited writes. Per namespace limits still apply. Read more on the [architecture page](/docs/architecture)
[^limits-note-8]: Limited by indexing performance, see "Max ingested, unindexed data". We are constantly working on improving indexing performance.
[^limits-note-9]: Throughput for [copy_from_namespace](/docs/write#param-copy_from_namespace). Cross-region copies may be 20-35% slower depending on distance. See [Cross-Region Backups](/docs/backups) for details.
[^limits-note-10]: There are no limits on branching. This means there is no limit on how many children branches a namespace can have (A->B, A->C, A->D,...) nor on the length of chains of branches (A->B, B->C, C->D,...). See the [branching guide](/docs/branching) for details.
[^limits-note-11]: Your write will contain a `rows_remaining` field indicating whether any rows were skipped. You can issue a duplicate patch_by_filter request to patch more rows. This limit is there to ensure that indexing and consistent queries can keep up with patches.
[^limits-note-12]: Your write will contain a `rows_remaining` field indicating whether any rows were skipped. You can issue a duplicate delete_by_filter request to delete more rows. This limit is there to ensure that indexing and consistent queries can keep up with deletes.
[^limits-note-13]: Ingested data is asynchronously indexed (see [architecture docs](/docs/architecture) for details). It is possible to ingest faster than we can index, causing a backlog. If the indexing backlog reaches this limit, upsert requests will return HTTP 429 until the backlog decreases. This ensures queries can be executed without excessive resource use and latency. We continuously improve indexing throughput. You can see the number of unindexed documents by sending a query and examining `.performance.exhaustive_search_count` in the response.
[^limits-note-14]: Due to turbopuffer's simple, horizontally scalable architecture with a cluster of Rust binaries pointing to object storage, scaling reads is easy. Per namespace limits still apply. Read more about batching on the [architecture page](/docs/architecture)
[^limits-note-15]: Adding read replicas can raise this limit to arbitrarily high values (contact us). Replicas will be added automatically in future versions of turbopuffer.
[^limits-note-16]: If this is exceeded, the 17th query waits up to 800ms to start. If it can't claim the semaphore in that window, it will return an HTTP 429. This limit serves to mitigate the noisy neighbour effect, and can be raised by contacting us. Note that query latency interacts with this limit to determine effective max QPS. For 50ms queries, the default limit allows >300 QPS. Eventually consistent queries can be enabled to improve throughput even further. As we improve performance, effective QPS will increase. Aggregate / group-by queries scan the namespace and use more CPU and I/O than typical vector or BM25 queries, so each one consumes 4 slots from this limit instead of 1. Exact-distance (kNN) vector queries are also more CPU and I/O intensive than ANN and consume 2 slots. Adding read replicas can raise this limit to arbitrarily high values (contact us). Replicas will be added automatically in future versions of turbopuffer.
[^limits-note-17]: Adding read replicas can raise concurrent queries and QPS to arbitrarily high values (contact us). Replicas will be automatically added in future versions of turbopuffer. For pinned namespaces, see [Pinned Replicas](/docs/pinning#replicas) for details.
[^limits-note-18]: This means the top 10 returned from turbopuffer has on average 90-95% of the true top 10. In the future, this is tunable, but currently the configuration is hardcoded for this recall. Vector search is fundamentally about the tradeoff between recall and other attributes like cost and performance. You can read more on our blog about how we monitor recall.
[^limits-note-19]: How large any individual attribute value can be. For arrays, this represents the total byte size of the array; there is no limit on the number of elements in an array.
[^limits-note-20]: How large any filterable attribute value can be. For arrays, this represents the maximum size of any element; there is no limit on the number of elements in an array.
[^limits-note-21]: Attribute names cannot start with $
[^limits-note-22]: Must match `[A-Za-z0-9-_.]{1,128}`
