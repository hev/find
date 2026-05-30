---
title: Building Pipelines
description: Define transformations, joins, and windowed aggregations.
group: Guides
order: 3
---

A pipeline is a sequence of stages declared in TOML. Each stage reads from the
previous one and emits records to the next. Stages are pure functions over the
record stream, which makes them easy to test in isolation.

Use a `filter` stage to drop records that don't match a predicate, a `map`
stage to reshape fields, and a `join` stage to enrich records from a second
source keyed on a shared field. Windowed aggregations let you compute rolling
counts, sums, and averages over a time window — useful for metrics and alerts.

When a pipeline restarts, Layer resumes from the last committed offset, so
exactly-once delivery is preserved across deploys.
