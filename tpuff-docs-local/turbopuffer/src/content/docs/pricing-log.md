---
title: "Pricing Changelog"
description: "This page tracks pricing changes over time. If you need help estimating impact for your workload, contact us. For more details on how your turbopuffer"
group: "API"
---

**Last updated:** April 3, 2026

This page tracks pricing changes over time. If you need help estimating impact
for your workload, [contact us](/contact/sales). For more details on how your turbopuffer bill is calculated, see our [pricing page](/pricing).

## 2026

### April 2026

Introduced [namespace pinning](/docs/pinning), which bills pinned namespaces in
GB-hours instead of per-query `TB Queried` pricing. Pinning cost scales with
namespace size, replica count, and time pinned, with minimums of 64 GB and 10
minutes.

### March 2026

Pricing for namespaces with [multiple vector columns](/docs/write#multiple-vector-columns):

- Filterable attributes are billed once per vector column for both writes and storage, reflecting the cost of maintaining indexes across multiple ANN indexes
- Non-filterable attributes are billed once regardless of the number of vector columns

### February 2026

Query pricing for the largest namespaces reduced by up to 94%:

- Base queried data rate decreased from $5/PB to $1/PB
- 80% marginal discount when queried data size is between 32 GB and 128 GB
- 96% marginal discount when queried data size is greater than 128 GB
- Minimum billable data per query increased from 256 MB to 1.28 GB

## 2025

### July 2025

Query pricing for large namespaces reduced by up to 80%:

- 80% marginal discount on bytes queried over 32 GB, per query

## 2024

### September 2024

Introduced `copy_from_namespace`, allowing data to be copied between namespaces at a 50% discount on write costs.
