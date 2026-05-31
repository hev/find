---
title: "Evaluate recall"
description: "POST /v1/namespaces/:namespace/debug/recall"
group: "API"
---

POST /v1/namespaces/:namespace/_debug/recall

Evaluate recall for documents in a namespace.

When you call this endpoint, it selects `num` random vectors that were
previously inserted. For each of these vectors, it performs an ANN index search
as well as a ground
truth exhaustive search.

Recall is calculated as the ratio of matching vectors between the two search
results. This endpoint also returns the average number of results returned from
both the ANN index search and the exhaustive search (ideally, these are equal).
Example of 90% recall@10:

```
             ANN                                          Exact
┌────────────────────────────┐               ┌────────────────────────────┐
│id: 9, score: 0.12          │▒              │id: 9, score: 0.12          │▒
├────────────────────────────┤▒              ├────────────────────────────┤▒
│id: 2, score: 0.18          │▒              │id: 2, score: 0.18          │▒
├────────────────────────────┤▒              ├────────────────────────────┤▒
│id: 8, score: 0.29          │▒              │id: 8, score: 0.29          │▒
┌────────────────────────────┤▒              ├────────────────────────────┤▒
│id: 1, score: 0.55          │▒              │id: 1, score: 0.55          │▒
┣─━─━─━─━─━─━─━─━─━─━─━─━─━─━┘▒   Mismatch   ┣─━─━─━─━─━─━─━─━─━─━─━─━─━─━┘▒
 id: 0, score: 0.90          ┃▒◀─────────────▶ id: 4, score: 0.85         ┃▒
┗ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ▒              ┗ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ━ ▒
 ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒               ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
```

We use this endpoint internally to measure recall. See this [blog
post](/blog/continuous-recall) for more.

This endpoint can run asynchronously.
See [Asynchronous requests](/docs/overview#asynchronous-requests).

## Request

  **num** number
default: 25

number of searches to run.

  ---
  **top_k** number
default: 10

search for top_k nearest neighbors.

  ---
  **filters** object
optional

filter by attributes, see [filtering
    parameters](/docs/reference/query#filter-parameters) for more info.

  ---
  **rank_by** array

The [ranking function](/docs/query#param-rank_by) to evaluate recall for.
  If this field is provided `num` must be either `null` or `1`.

## Response

**avg_recall** number

The average recall across all sampled queries, expressed as a decimal between 0 and 1. A value of 1.0 indicates perfect recall (100% of exhaustive search results were found by the approximate nearest neighbour search).

**avg_exhaustive_count** number

The average number of results returned by the exhaustive search across all queries. This represents the ideal number of results that should be returned.

**avg_ann_count** number

The average number of results returned by the approximate nearest neighbor index search across all queries. In most cases this should equal `avg_exhaustive_count`.

## Examples

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v1/namespaces/recall-example-curl/_debug/recall \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "num": 5,
   "top_k": 10
 }'

# Response payload
# {
#   "avg_recall": 1.0,
#   "avg_exhaustive_count": 10.0,
#   "avg_ann_count": 10.0
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'recall-example-py')

# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
recall = ns.recall(num=5, top_k=10)
print(recall)
# NamespaceRecallResponse(avg_ann_count=10.0, avg_exhaustive_count=10.0, avg_recall=1.0)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`recall-example-ts`);

const recall = await ns.recall({
  num: 5,
  top_k: 10,
});
console.log(recall);
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

	ns := tpuf.Namespace("recall-example-go")

	// If an error occurs, this call raises an error if a retry was not successful.
	recall, err := ns.Recall(ctx, turbopuffer.NamespaceRecallParams{
		Num:  turbopuffer.Int(5),
		TopK: turbopuffer.Int(10),
	})
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(recall)) // returns a NamespaceRecallResult
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class Recall {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("recall-example-java");

    // If an error occurs, this call raises a TurbopufferServiceException if
    // a retry was not successful.
    var recall = ns.recall(NamespaceRecallParams.builder().num(5).topK(10).build());
    System.out.println(recall);
    // NamespaceRecallResponse{avgAnnCount=10.0, avgExhaustiveCount=10.0, avgRecall=1.0}
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("recall-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// If an error occurs, this call raises a TurbopufferApiException if
// a retry was not successful.
var recall = await ns.Recall(new NamespaceRecallParams { Num = 5, TopK = 10 });
Console.WriteLine(recall);
// {"avg_recall": 1.0, "avg_exhaustive_count": 10.0, "avg_ann_count": 10.0}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("recall-example-rb")

# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
recall = ns.recall(num: 5, top_k: 10)
puts recall
# {avg_ann_count: 10.0, avg_exhaustive_count: 10.0, avg_recall: 1.0}
```
<!-- /multilang -->

How to interpret this response:

- A recall of 1.0 means that 100% of the ideal results (from the exhaustive search) were also present in the approximate ANN results
- `avg_ann_count` equals `avg_exhaustive_count`, meaning the approximate search returned the same number of results as the exhaustive

## Billing

Billed as queries when `avg_recall` is at least 0.9 and the namespace is not empty. The number of queries is one per sample per 100K documents, with a
minimum of `num` queries. 

For example, `num=30` on a 1M document namespace is billed as 300 queries.
On a smaller namespace with under 100K documents and `num=30`, it would be 30 queries.
