---
title: "Architecture"
description: "The API routes to a cluster of Rust binaries that access your database on object storage (see regions for more on routing)."
group: "Concepts"
---

The API routes to a cluster of Rust binaries that access your
database on object storage (see [regions](https://turbopuffer.com/docs/regions) for more on routing).

After the first query, the namespace's documents are cached on NVMe SSD.
Subsequent queries are routed to the same query node for cache locality, but any
query node can serve queries from any namespace.  The first query to a namespace
reads object storage directly and is slow (p50=874ms for 1M documents),
but subsequent, cached queries to that node are faster (p50=14ms
for 1M documents). Many use-cases can send a [pre-flight query to hint
that the client will send latency-sensitive requests in the near future](/docs/warm-cache).

turbopuffer is a multi-tenant service, which means each `./tpuf` binary handles requests for multiple tenants.
This keeps costs low. Enterprise customers can be isolated on request either
through [single-tenancy clusters, or BYOC](/docs/security):

```
                        ╔═ turbopuffer ════════════════════════════╗
╔════════════╗          ║                                          ║░
║            ║░         ║  ┏━━━━━━━━━━━━━━━┓     ┏━━━━━━━━━━━━━━┓  ║░
║   client   ║░───API──▶║  ┃    Memory/    ┃────▶┃    Object    ┃  ║░
║            ║░         ║  ┃   SSD Cache   ┃     ┃ Storage (S3) ┃  ║░
╚════════════╝░         ║  ┗━━━━━━━━━━━━━━━┛     ┗━━━━━━━━━━━━━━┛  ║░
 ░░░░░░░░░░░░░░         ║                                          ║░
                        ╚══════════════════════════════════════════╝░
                         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Each namespace has its own prefix on object storage. turbopuffer
uses a write-ahead log (WAL) to ensure consistency. Every write adds
a new file to the WAL directory inside the namespace's prefix. If a
write returns successfully, data is guaranteed to be durably written
to object storage. This means high write throughput (~10,000+
vectors/sec), at the cost of high write latency (p50=285ms for 500kB).

Each namespace can currently write 1 WAL entry per second. Concurrent writes to
the same namespace are batched into the same entry. If a new batch is started
within one second of the previous one, it will take up to 1 second to commit.

```
                                              mem buffer
                                              ┌──────┐
            UPSERT/PATCH/DELETE               │░░░░░░│
            ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ─▶│░░░░░░│
                                              │░░░░░░│
                                              └──┬───┘
WAL                                              │ group commit (<= 1/s)
s3://tpuf/{namespace_id}/wal                     ▼
╔═════════════════════════════════════════════════════════╗
║┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             ║░
║│██████│ │██████│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│             ║░
║│██████│ │██████│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│             ║░
║│██████│ │██████│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│             ║░
║└──────┘ └──────┘ └──────┘ └──────┘ └──────┘             ║░
║ 01.bin   02.bin ▲ 03.bin   04.bin   05.bin ▲ (06.bin)   ║░
╚═════════════════│══════════════════════════│════════════╝░
 ░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░ 
                  │                          │ 
             index cursor                CAS commit 
                                           point

█ indexed + committed   ▓ committed, unindexed   ░ written, not committed

~10ms for consistent read
```

After data is committed to the log, it is asynchronously indexed to
enable efficient retrieval (■). Any data that has not yet been
indexed is still available to search (◈), with a slower exhaustive
search of recent data in the log.

turbopuffer provides strong consistency by default, i.e. if you
perform a write, a subsequent query will immediately see the write.
However, you can configure your queries to be [eventually consistent](/docs/query#param-consistency) for lower warm latency.
With eventual consistency, staleness of up to about one hour can be observed in the worst case.

Both the approximate nearest neighbour (ANN) index we use for
vectors, as well as the inverted [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) index we use for full-text search have been optimized for object
storage to provide good cold latency (~500ms on 1M documents).
Additionally, we build exact indexes for [metadata filtering](/docs/query#filtering-parameters).

```
                   ╔═══turbopuffer region═════════════╗
                   ║      ┌─────────────────────────┐ ╠──┐
                   ║      │     ./tpuf indexer      │ ║░ │
                   ║      └─────────────────────────┘ ║░ │
                   ║      ┌─────────────────────────┐ ║░ │
                   ║      │     ./tpuf indexer      │ ║░ │
                   ║      └─────────────────────────┘ ║░ │   ╔═══Object Storage══════════════╗
                   ║                                  ║░ │   ║ ┏━━Indexing Queue━━━━━━━━━━━┓ ║░
                   ║      ┌─────────────────────────┐ ║░ │   ║ ┃■■■■■■■■■                  ┃ ║░
                   ║      │      ./tpuf query       │ ║░ │   ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║░
                   ║      │┌─Memory Cache──────────┐│ ║░ │   ║ ┏━/{org_id}/{namespace}━━━━━┓ ║░
                   ║      ││■■■■■■■■■■             ││ ║░ │   ║ ┃ ┏━/wal━━━━━━━━━━━━━━━━━━┓ ┃ ║░
                   ║   ┌─▶│└───────────────────────┘│ ║░ └──▶║ ┃ ┃■■■■■■■■■■■■■■■◈◈◈◈    ┃ ┃ ║░
                   ║   │  │┌─NVMe Cache────────────┐│ ║░     ║ ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━┛ ┃ ║░
                   ║   │  ││■■■■■■■■■■■■■■■■■■■■■  ││ ║░ ┌──▶║ ┃ ┏━/index━━━━━━━━━━━━━━━━┓ ┃ ║░
                ┌──╩─┐ │  │└───────────────────────┘│ ║░ │   ║ ┃ ┃■■■■■■■■■■■■■■■        ┃ ┃ ║░
╔══════════╗    │    │ │  └─────────────────────────┘ ║░ │   ║ ┃ ┗━━━━━━━━━━━━━━━━━━━━━━━┛ ┃ ║░
║  Client  ║───▶│ LB │─┤  ┌─────────────────────────┐ ║░ │   ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ║░
╚══════════╝░   │    │ │  │      ./tpuf query       │ ║░ │   ╚═══════════════════════════════╝░
 ░░░░░░░░░░░░   └──╦─┘ │  │┌─Memory Cache──────────┐│ ║░ │    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                   ║   │  ││■■■■■■■■■■             ││ ╠──┘
                   ║   └─▶│└───────────────────────┘│ ║░
                   ║      │┌─NVMe Cache────────────┐│ ║░
                   ║      ││■■■■■■■■■■■■■■■■■■■■■  ││ ║░
                   ║      │└───────────────────────┘│ ║░
                   ║      └─────────────────────────┘ ║░
                   ╚══════════════════════════════════╝░
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Vector indexes are based on [SPFresh](https://dl.acm.org/doi/10.1145/3600006.3613166). SPFresh is a centroid-based approximate nearest neighbour index.
It has a fast index for locating the nearest centroids to the query
vector. A centroid-based index works well for object storage as it
minimizes roundtrips and write-amplification, compared to
graph-based indexes like HNSW or DiskANN.

On a cold query, the centroid index is downloaded from object
storage. Once the closest centroids are located, we simply fetch
each cluster's offset in one, massive roundtrip to object storage.

In reality, there are more roundtrips required for turbopuffer to
support consistent writes and work on large indexes. From first
principles, each roundtrip to object storage takes ~100ms. The 3-4
required roundtrips for a cold query often take as little as ~400ms.

When the namespace is cached in NVME/memory rather than fetched
directly from object storage, the query time drops dramatically to
p50=14. The roundtrip to object storage for consistency,
which we can relax on request for eventually consistent sub 10ms queries.

1. *Metadata is downloaded for the turbopuffer storage engine. The
storage engine is optimized for minimizing roundtrips.*

2. *The second roundtrip starts navigating the first level of the
indexes. In many cases, only one additional roundtrip is required.
But the query planner makes decisions about how to efficiently
navigate the indexes. It needs to settle tradeoffs between
additional roundtrips and fetching more data in an existing
roundtrip.*
