---
title: "Namespace Branching"
description: "Branching creates an instant, copy-on-write clone of a namespace via branchfrom."
group: "Operations"
---

Branching creates an instant, copy-on-write clone of a namespace via `branch_from`.

- **Constant-time** regardless of namespace size
- **Fully independent** — reads, writes, queries, and deletes on either namespace don't affect the other
- **Branch from branches** — multi-level workflows like per-developer branches from staging
- **Unlimited** — no limit on child branches per namespace (A→B, A→C, A→D, ...) nor on length of branch chains (A→B, B→C, C→D, ...)

**Namespace branching** is rolling out in select regions. To join the private
beta, [contact us](/contact/support).

## Pricing

Pricing may change before GA.

Branching is billed at a flat rate of $0.032.

Storage of a branched namespace is billed on logical bytes at standard rates —
each branch is billed as if it were an independent namespace. We plan to reduce
this once we've observed branching in production and learned what the reuse
rates are.

## When to use branching vs copy_from_namespace

Use [`copy_from_namespace`](/docs/write#param-copy_from_namespace) when you
need a backup with full data isolation (branching shares underlying storage),
when copying across regions or organizations (see the [cross-region backups
guide](/docs/backups)), or when re-encrypting a namespace with a different
[CMEK key](/docs/cmek).

Use branching otherwise.

## Use cases

- **Codebase indexing.** Embed a codebase once; branch per local checkout so only changed files need re-indexing.
- **Test pipelines.** Branch a production namespace, run tests against real data, tear it down when done.
- **Development environments.** Give each developer a sandbox of a shared dataset.
- **Snapshots.** Capture the state of a changing namespace at a point in time, query the immutable snapshot many times, discard when finished.

## Deleting branches

Both the source and branched namespaces are fully independent after creation.
Deleting a branch does not affect the source namespace, and deleting the source
does not affect any branches. Use the standard
[delete namespace](/docs/delete-namespace) endpoint to remove either one.

## Example

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/branching-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
  \"branch_from_namespace\": \"branching-example-source-curl\"
}"
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

source = tpuf.namespace(f'branching-example-source-py')

ns = tpuf.namespace(f'branching-example-py')
ns.branch_from(source_namespace=f'branching-example-source-py')

# Write to the branch
ns.write(upsert_rows=[{'id': 3, 'title': 'New'}])

# Branch has source data + new write
result = ns.query(rank_by=('id', 'asc'), top_k=10, include_attributes=['title'])
print(result.rows)

# Source is unaffected
result = source.query(rank_by=('id', 'asc'), top_k=10, include_attributes=['title'])
print(result.rows)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const source = tpuf.namespace(`branching-example-source-ts`);

const ns = tpuf.namespace(`branching-example-ts`);
await ns.branchFrom({ source_namespace: `branching-example-source-ts` });

// Write to the branch
await ns.write({ upsert_rows: [{ id: 3, title: "New" }] });

// Branch has source data + new write
const branchResult = await ns.query({ rank_by: ["id", "asc"], top_k: 10, include_attributes: ["title"] });
console.log(branchResult.rows);

// Source is unaffected
const sourceResult = await source.query({ rank_by: ["id", "asc"], top_k: 10, include_attributes: ["title"] });
console.log(sourceResult.rows);
```
```go
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	source := tpuf.Namespace("branching-example-source-go")

	ns := tpuf.Namespace("branching-example-go")
	_, err = ns.BranchFrom(ctx, turbopuffer.NamespaceBranchFromParams{
		SourceNamespace: "branching-example-source-go",
	})
	if err != nil {
		panic(err)
	}

	// Write to the branch
	_, err = ns.Write(ctx, turbopuffer.NamespaceWriteParams{
		UpsertRows: []turbopuffer.RowParam{{"id": 3, "title": "New"}},
	})
	if err != nil {
		panic(err)
	}

	// Branch has source data + new write
	branchResult, err := ns.Query(ctx, turbopuffer.NamespaceQueryParams{
		RankBy:            turbopuffer.NewRankByAttribute("id", turbopuffer.RankByAttributeOrderAsc),
		TopK:              turbopuffer.Int(10),
		IncludeAttributes: turbopuffer.IncludeAttributesParam{
			StringArray: []string{"title"},
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(turbopuffer.PrettyPrint(branchResult.Rows))

	// Source is unaffected
	sourceResult, err := source.Query(ctx, turbopuffer.NamespaceQueryParams{
		RankBy:            turbopuffer.NewRankByAttribute("id", turbopuffer.RankByAttributeOrderAsc),
		TopK:              turbopuffer.Int(10),
		IncludeAttributes: turbopuffer.IncludeAttributesParam{
			StringArray: []string{"title"},
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(turbopuffer.PrettyPrint(sourceResult.Rows))
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class Branch {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var source = tpuf.namespace("branching-example-source-java");

    var ns = tpuf.namespace("branching-example-java");
    ns.branchFrom(
      NamespaceBranchFromParams.builder()
        .sourceNamespace("branching-example-source-java")
        .build()
    );

    // Write to the branch
    ns.write(
      NamespaceWriteParams.builder()
        .upsertRows(List.of(Row.builder().put("id", 3).put("title", "New").build()))
        .build()
    );

    // Branch has source data + new write
    var branchResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
        .topK(10)
        .includeAttributes(List.of("title"))
        .build()
    );
    System.out.println(branchResult.rows());

    // Source is unaffected
    var sourceResult = source.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
        .topK(10)
        .includeAttributes(List.of("title"))
        .build()
    );
    System.out.println(sourceResult.rows());
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var source = tpuf.Namespace("branching-example-source-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var ns = tpuf.Namespace("branching-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));
await ns.BranchFrom(
    new NamespaceBranchFromParams
    {
        SourceNamespace = "branching-example-source-csharp-" + Environment.GetEnvironmentVariable("NONCE"),
    }
);

// Write to the branch
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows = [new Row().Set("id", 3).Set("title", "New")],
    }
);

// Branch has source data + new write
var branchResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
        Limit = 10,
        IncludeAttributes = new List<string> { "title" },
    }
);
foreach (var row in branchResult.GetRows())
{
    Console.WriteLine(row);
}

// Source is unaffected
var sourceResult = await source.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
        Limit = 10,
        IncludeAttributes = new List<string> { "title" },
    }
);
foreach (var row in sourceResult.GetRows())
{
    Console.WriteLine(row);
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

source = tpuf.namespace("branching-example-source-rb")

ns = tpuf.namespace("branching-example-rb")
ns.branch_from(source_namespace: "branching-example-source-rb")

# Write to the branch
ns.write(upsert_rows: [{ id: 3, title: "New" }])

# Branch has source data + new write
branch_result = ns.query(rank_by: ["id", "asc"], top_k: 10, include_attributes: ["title"])
puts branch_result.rows

# Source is unaffected
source_result = source.query(rank_by: ["id", "asc"], top_k: 10, include_attributes: ["title"])
puts source_result.rows
```
<!-- /multilang -->
