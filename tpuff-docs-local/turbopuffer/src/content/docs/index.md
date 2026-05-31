---
title: "Introduction"
description: "turbopuffer is a fast search engine that combines vector and full-text search using object storage, making all your data easily searchable."
group: "Overview"
---

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

turbopuffer is a fast search engine that combines vector and full-text search
using object storage, making all your data easily searchable.

Using only object storage for state and NVMe SSD with memory cache for compute,
turbopuffer scales horizontally to handle billions of documents.

The system caches only actively searched data while keeping the rest in low-cost
object storage, offering competitive pricing. Cold queries for 1 million
vectors take p90=1214ms, while warm
queries are just p50=14ms.
This architecture means it's as fast as in-memory search engines when cached, but far
cheaper to run.

Storing data in cache and object storage costs less than traditional replicated
disk systems, even for frequently accessed data.

Using object storage as the sole source of truth enables operations like
[branching](/docs/branching) — a copy-on-write clone of any namespace, created
in constant time regardless of size, with fully independent reads and writes
afterward.

turbopuffer is focused on first-stage retrieval to efficiently narrow millions
of documents down to tens or hundreds. While it may have fewer features than
traditional search engines, this streamlined approach enables higher quality,
more maintainable search applications that you can customize in your preferred
programming language. See [Hybrid Search](/docs/hybrid-search) to get started.

To get started with turbopuffer, see the [quickstart guide](/docs/quickstart).

For more technical details, see [Architecture](/docs/architecture),
[Guarantees](/docs/guarantees), and [Tradeoffs](/docs/tradeoffs).
