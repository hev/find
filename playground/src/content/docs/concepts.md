---
title: Core Concepts
description: The mental model behind Layer — sources, pipelines, and sinks.
group: Overview
order: 1
---

Layer moves data between systems as a continuous stream. The three building
blocks are **sources** (where records originate), **pipelines** (the
transformations applied in flight), and **sinks** (where results land).

## Sources, pipelines, and sinks

A source can be a database change feed, a message queue, or an HTTP endpoint.
Records flow through one or more pipeline stages, where you filter, enrich,
join, and reshape them. Sinks then deliver the transformed records to their
destination — another database, an object store, or a downstream service.

## Kubernetes autoscaling

Layer exposes lag and throughput signals that Kubernetes can use for horizontal
autoscaling. When consumers fall behind, scale rules add workers; when lag is
drained, the deployment scales back down without interrupting active pipelines.

## Backpressure

Backpressure is handled automatically: when a sink slows down, the pipeline
applies flow control upstream so no records are dropped.
