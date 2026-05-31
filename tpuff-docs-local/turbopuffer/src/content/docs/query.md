---
title: "Query documents"
description: "POST /v2/namespaces/:namespace/query"
group: "API"
---

POST /v2/namespaces/:namespace/query

Query, filter, full-text search and vector search documents.

| | p50 | p90 | p99 |
|---|---|---|---|
| warm (10M docs) | 14ms | 17ms | 27ms |
| cold (10M docs) | 874ms | 1214ms | 1686ms |

A query retrieves documents in a single [namespace](/docs/write), returning the
ordered or highest-ranked documents that match the query's filters.

turbopuffer supports the following types of queries:

  * [Vector search](#vector-search): find the documents closest to a query vector using approximate nearest neighbor (ANN)
  * [kNN (exact search)](#knn-exact-search): find the exact nearest neighbors over a filtered subset
  * [Full-text search](#full-text-search): find documents with the highest
    [BM25 score](https://en.wikipedia.org/wiki/Okapi_BM25), a classic text search algorithm
    that considers query term frequency and document length
  * [Sparse vector search](#sparse-vector-search): find the documents closest to a query sparse vector
  * [Ordering by attributes](#ordering-by-attributes): find all documents matching filters in order of an attribute
  * [Lookups](#lookups): find all documents matching filters when order isn't important
  * [Aggregations](#aggregations): aggregate attribute values across all documents matching filters
  * [Grouped aggregations](#group-by): aggregate while grouping by one or more attributes
  * [Multi-queries](#multi-queries): send multiple queries to the same namespace used for hybrid searches.

turbopuffer is fast by default. See [Performance](/docs/performance) for how you can influence performance.

## Request

**rank_by** array
required unless aggregate_by is set

How to rank the documents in the namespace. Supported ranking functions:

  * [ANN](#vector-search) ("approximate nearest neighbor")
  * [kNN](#knn-exact-search) ("exact nearest neighbor", requires filters)
  * [BM25](#full-text-search) (combine with [Sum](#fts-operators), [Max](#fts-operators))
  * [SparseKNN](#sparse-vector-search) (sparse vector search)
  * [Order by attribute](#ordering-by-attributes)

Documents with a score of zero are excluded from results.

For [hybrid search](/docs/hybrid-search), you can use [multi-queries](#multi-queries) (e.g. BM25 + vector) and combine the results client-side with e.g. reciprocal-rank fusion. We encourage users to write a strong query layer abstraction, as it's not uncommon to do several turbopuffer queries per user query.

**Vector example (ANN):** `["vector", "ANN", [0.1, 0.2, 0.3, ..., 76.8]]`

**Vector example (kNN):** `["vector", "kNN", [0.1, 0.2, 0.3, ..., 76.8]]` (requires filters)

**BM25:** `["text", "BM25", "fox jumping"]`

**SparseKNN** `["sparse_vector", "SparseKNN", {"dim0": 0.1, "dimt1": 0.2, ...}]`

**Order by attribute example:** `["timestamp", "desc"]`

**BM25 with multiple, weighted fields:**

```json
["Sum", [
    ["Product", 2, ["title", "BM25", "fox jumping"]],
    ["content", "BM25", "fox jumping"]
  ]
]
```

---

**top_k** number

Alias for [limit.total](#param-limit).

  Maximum: 10,000

---

**filters** array
optional

Exact filters for attributes to refine search results for. Think of it as a SQL
WHERE clause.

See [Filtering Parameters](#filtering-parameters) below for details.

When combined with a vector, the query planner will automatically combine the
attribute index and the approximate nearest neighbor index for best performance
and recall. See our post on [Native Filtering](/blog/native-filtering)
for details.

For the best performance, separate documents into namespaces instead of
filtering where possible. See also [Performance](/docs/performance).

**Example:** `["And", [["id", "Gte", 1000], ["permissions", "ContainsAny", ["3d7a7296-3d6a-4796-8fb0-f90406b1f621", "92ef7c95-a212-43a4-ae4e-0ebc96a65764"]]]]`

---

**include_attributes** array[string] | boolean
default: id

List of attribute names to return in the response. Can be set to `true` to
  return all attributes. Return only the ones you need for best performance.

---

**exclude_attributes** array[string]

List of attribute names to exclude from the response. All other attributes
  will be included in the response. Exclude any attributes you don't need for
  best performance.

  Unlike `include_attributes`, attributes that do not exist in the schema are silently ignored.

  Cannot be specified with [include_attributes](#param-include_attributes).

  **Example:** `["vector", "big_attribute"]`

---

**limit** number | object
required

Limits the number of documents returned.

  Can be a number to apply a total limit, or an object with the following
  fields:

    * `total` (number, required): limits the total number of documents returned

      Maximum: 10,000

    * `per` (object, optional): limits the number of documents with the same value for a
      set of attributes (the "limit key") that can appear in the results.
      * `attributes` (string array): the attributes to include in the limit key
      * `limit` (number): the maximum number of documents to return for each
        value of the limit key

      `per` is only supported for [order by attribute](#ordering-by-attributes)
      queries. Support for BM25 and ANN queries is on our roadmap.

  **Example (simple total):**

  ```json
  {"limit": 10}
  ```

  **Example (limit per category and size):**

  ```json
  {
    "limit": {
      "per": {"attributes": ["category", "size"], "limit": 10},
      "total": 10
    }
  }
  ```

    See [Diversification](#diversification) below for details.

---

**aggregate_by** object
required unless rank_by is set

[Aggregations](#aggregations) to compute over all documents in the namespace
  that match the [filters](#param-filters).

  Cannot be specified with [rank_by](#param-rank_by) or
  [include_attributes](#param-include_attributes).

  Each entry in the object maps a label for the aggregation to
  an aggregate function. Supported aggregate functions:

  * `["Count"]`: counts the number of documents.
  * `["Sum", "attribute_name"]`: sums the values of the specified scalar numeric attribute (supports `int`, `uint`, `float`)

  **Example:** `{"aggregate_by": {"my_count": ["Count"]}}`

---

**group_by** array

Only valid when [`aggregate_by`](#param-aggregate_by) is set.

  Groups documents by the specified attributes or expressions (the "group key")
  before computing aggregates. Aggregates are computed separately for each
  group.

  Up to [limit.total](#param-limit) groups are returned, ordered by group key.

  **Example:** `{"aggregate_by": {"count_by_color_and_size": ["Count"]}, "group_by": ["color", "size"]}`

---

**queries** array

Send an array of query objects to be executed simultaneously and atomically.

Up to 16 queries can be sent per request.
Each subquery will count against the [concurrent query limit](/docs/limits) for
the namespace. If you need a higher limit, please [contact us](/contact).

The provided array should consist of query objects, including every field except for `vector_encoding` or `consistency`, which should be set on the root object.

The `queries` field is mutually exclusive with other query object fields. A request can contain either a multi-query or an ordinary query.

---

**vector_encoding** string
default: float

The encoding to use for the vectors in the response. The supported encodings
  are `float` and `base64`.

  If `float`, vectors are returned as arrays of numbers.

  If `base64`, vectors are returned as base64-encoded strings representing the
  vectors serialized in little-endian float32 binary format.

  This parameter has no effect if no vector attributes are included in the
  response (see the [include_attributes](#param-include_attributes) parameter).

---

**consistency** object
default: {'level': 'strong'}

Controls the consistency level for the query. This determines whether the cache is
updated and how much recently written data is included in query results.

**Strong consistency (default):** `{"level": "strong"}`

Searches all unindexed writes and updates the cache. This ensures the query includes
all data written before the query started, providing the strongest consistency guarantees.

**Eventual consistency:** `{"level": "eventual"}`

Searches at most 128MiB of unindexed writes. Use when you need higher query
throughput and can tolerate stale results.

Most updates are visible immediately since
queries usually hit the writing node. [Over 99.8% of queries return consistent data](/docs/query#param-consistency), however staleness of about 100ms can be observed during (rare) scaling/failover operations, and staleness of up to about one hour can be observed after significant writes. Specifically, once a namespace has more than 128MiB of outstanding writes, further writes are not visible until they are indexed and loaded into cache. For small namespaces indexing and cache warming takes tens of seconds; for large namespaces this process can take tens of minutes.

## Response

**rows** array

An array of the [limit.total](#param-limit) documents that matched the query, ordered by the ranking function. Only present if [rank_by](#param-rank_by) is specified.

Each document is an object containing the [requested attributes](#param-include_attributes). The `id` attribute is always included. The special attribute `$dist` is set to the ranking function's score for the document (distance from the query vector for `ANN`; BM25 score for `BM25`; omitted when ordering by an attribute).

**Example:**

```json
[
  {"$dist": 1.7, "id": 8, "extra_attr": "puffer"},
  {"$dist": 3.1, "id": 20, "extra_attr": "fish"}
]
```

**results** array

An array of response objects containing the results for each sub-query of a [multi-query](#multi-queries) request, the result objects are returned in the same order as the queries.

```json
[
    {
      "rows": [
        {
          "$dist": 0.0,
          "id": 0
        }
      ]
    },
    {
      "aggregations": {
        "my_count_of_ids": 42
      }
    }
  ]
```

**aggregations** object

An object mapping the label for each
[requested aggregation](#param-aggregate_by) to the computed value.

Only present if [aggregate_by](#param-aggregate_by) is specified but
[group_by](#param-group_by) is **not** specified.

**Example:**

```json
{ "my_count_of_ids": 42 }
```

**aggregation_groups** array

An array of objects, one for each aggregation group, containing
the [group key](#param-group_by) and the computed value of each
[requested aggregation](#param-aggregate_by).

Only present if both [aggregate_by](#param-aggregate_by) and
[group_by](#param-group_by) are specified.

**Example:**

```json
[
  // Sorted by group key. No more than limit.total groups are returned.
  { "color": "blue", "size": "small", "my_grouped_count": 2 },
  { "color": "blue", "size": "medium", "my_grouped_count": 7 },
  { "color": "red", "size": "small", "my_grouped_count": 4 }
]
```

**billing** object

The billable resources consumed by the query. The object contains the following fields:

* `billable_logical_bytes_queried` (uint): the number of logical bytes processed by the query
* `billable_logical_bytes_returned` (uint): the number of logical bytes returned by the query

**performance** object

The performance metrics for the query. The object currently contains the following fields, but these fields may change name, type, or meaning in the future:

* `cache_hit_ratio` (float): the ratio of cache hits to total cache lookups
* `cache_temperature` (string): a qualitative description of the cache hit ratio (`hot`, `warm`, or `cold`)
* `server_total_ms` (uint): request time measured on the server, including time spent waiting for other queries to complete if the namespace was at its [concurrency limit](/docs/limits)
* `query_execution_ms` (uint): request time measured on the server, excluding time spent waiting due to the namespace concurrency limit
* `exhaustive_search_count` (uint): the number of unindexed documents processed by the query
* `approx_namespace_size` (uint): the approximate number of documents in the namespace
* `last_included_write_at` (string): the timestamp of the last write operation that the query observed

[Contact the turbopuffer team](/contact) if you need help interpreting these metrics.

## Examples

### Vector Search

The query vector must have the same dimensionality as the vector column being queried.

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-vector-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["vector", "ANN", [0.1, 0.1]],
   "limit": 10
 }'

# Response payload
# {
#   "rows": [
#     { "$dist": 0.0, "id": 1 },
#     { "$dist": 2.0, "id": 2 },
#     ...
#   ]
# }
```
```python
# $ pip install turbopuffer
import turbopuffer
import os

tpuf = turbopuffer.Turbopuffer(
    # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    api_key=os.getenv("TURBOPUFFER_API_KEY"),
    # Pick the right region: https://turbopuffer.com/docs/regions
    region="gcp-us-central1",
)

ns = tpuf.namespace(f'query-vector-example-py')

# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
result = ns.query(
    rank_by=("vector", "ANN", [0.1, 0.1]),
    limit=10
)
print(result.rows)

# Prints a list of row-oriented documents:
# [
#   Row(id=1, vector=None, $dist=0.0),
#   Row(id=2, vector=None, $dist=2.0)
# ]
```
```typescript
// $ npm install @turbopuffer/turbopuffer
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`query-vector-example-ts`);

const result = await ns.query({
  rank_by: ["vector", "ANN", [0.1, 0.1]],
  limit: 10,
});
console.log(result.rows);
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
		// API tokens are created in the dashboard: https://turbopuffer.com/dashboard
		option.WithAPIKey(os.Getenv("TURBOPUFFER_API_KEY")),
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-vector-example-go")
	// If an error occurs, this call raises an error if a retry was not successful.
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByAnn("vector", []float32{0.1, 0.1}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))

	// Returns a row-oriented result:
	// [
	//   {"id": 1, "vector": null, "$dist": 0.0},
	//   {"id": 2, "vector": null, "$dist": 2.0}
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryVector {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-vector-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.ann("vector", List.of(0.1f, 0.1f)))
        .limit(10)
        .build()
    );
    System.out.println(result.rows().get());
    // Prints a list of row-oriented documents:
    // [
    //   {id=1, vector=None, $dist=0.0},
    //   {id=2, vector=None, $dist=2.0}
    // ]
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
    // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    // Loaded from TURBOPUFFER_API_KEY env var by default. Override if necessary:
    // ApiKey = "...",

    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("query-vector-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Ann("vector", new[] { 0.1f, 0.1f }),
        Limit = 10,
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// Prints a list of row-oriented documents:
// {"$dist": 0.0, "id": 1}
// {"$dist": 2.0, "id": 2}
```
```ruby
# $ gem install turbopuffer
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  api_key: ENV["TURBOPUFFER_API_KEY"],
  # Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
)

ns = tpuf.namespace("query-vector-example-rb")

# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
result = ns.query(
  rank_by: ["vector", "ANN", [0.1, 0.1]],
  limit: 10,
)
puts result.rows

# Prints a list of row-oriented documents:
# {id: 1, dist: 0.0}
# {id: 2, dist: 2.0}
```
<!-- /multilang -->

### Filters

When you need to filter documents, you can combine filters with vector search or use them alone. Here's an example of finding recent public documents:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-filters-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "filters": ["And", [
     ["timestamp", "Gte", "2024-03-01T00:00:00.000Z"],
     ["public", "Eq", true]
   ]],
   "rank_by": ["vector", "ANN", [0.1, 0.2, 0.3]],
   "limit": 10,
   "include_attributes": ["title", "timestamp"]
 }'
```
```python
from datetime import datetime
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-filters-example-py')

result = ns.query(
    filters=('And', (
        ('timestamp', 'Gte', datetime(2024, 3, 1, 0, 0, 0)),  # Documents after March 1, 2024
        ('public', 'Eq', True)
    )),
    rank_by=("vector", "ANN", [0.1, 0.2, 0.3]),  # Optional: include vector to combine with filters
    limit=10,
    include_attributes=['title', 'timestamp']
)
print(result.rows)

# Prints a list of row-oriented documents:
# [
#   Row(id=1, vector=None, $dist=0.15, title='Getting Started Guide', timestamp='2024-03-02T00:00:000000000Z'),
#   Row(id=2, vector=None, $dist=0.28, title='Advanced Features', timestamp='2024-03-03T00:00:000000000Z'),
# ]
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-filters-example-ts`);

const result = await ns.query({
  filters: [
    "And",
    [
      ["timestamp", "Gte", new Date("2024-03-01")], // Documents after March 1, 2024
      ["public", "Eq", true],
    ],
  ],
  rank_by: ["vector", "ANN", [0.1, 0.2, 0.3]], // Optional: include vector to combine with filters
  limit: 10,
  include_attributes: ["title", "timestamp"],
});

console.log(result.rows);
// Returns a row-oriented result:
// [
//   {id: 1, $dist: 0.15, title: "Getting Started Guide", timestamp: "2024-03-02T00:00:000000000Z"},
//   {id: 2, $dist: 0.28, title: "Advanced Features", timestamp: "2024-03-03T00:00:000000000Z"}
// ]
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-filters-example-go")

	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				// Documents after March 1, 2024
				turbopuffer.NewFilterGte("timestamp", time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC)),
				turbopuffer.NewFilterEq("public", true),
			}),
			// Optional: include vector to combine with filters
			RankBy: turbopuffer.NewRankByAnn("vector", []float32{0.1, 0.2, 0.3}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"title", "timestamp"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))

	// Returns a row-oriented result:
	// [
	//   {"id": 1, "$dist": 0.15, "title": "Getting Started Guide", "timestamp": "2024-03-02T00:00:000000000Z"},
	//   {"id": 2, "$dist": 0.28, "title": "Advanced Features", "timestamp": "2024-03-03T00:00:000000000Z"}
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.time.*;
import java.util.*;

public class QueryFilters {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-filters-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .filters(
          Filter.and(
            Filter.gte("timestamp", ZonedDateTime.of(2024, 3, 1, 0, 0, 0, 0, ZoneOffset.UTC)), // Documents after March 1, 2024
            Filter.eq("public", true)
          )
        )
        .rankBy(RankBy.ann("vector", List.of(0.1f, 0.2f, 0.3f))) // Optional: include vector to combine with filters
        .limit(10)
        .includeAttributes("title", "timestamp")
        .build()
    );

    System.out.println(result.rows().get());
    // Prints a list of row-oriented documents:
    // [
    //   {id=1, vector=None, $dist=0.15, title='Getting Started Guide', timestamp='2024-03-02T00:00:00'},
    //   {id=2, vector=None, $dist=0.28, title='Advanced Features', timestamp='2024-03-03T00:00:00'}
    // ]
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

var ns = tpuf.Namespace("query-filters-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        Filters = Filter.And(
            Filter.Gte("timestamp", new DateTime(2024, 3, 1, 0, 0, 0, DateTimeKind.Utc)), // Documents after March 1, 2024
            Filter.Eq("public", true)
        ),
        RankBy = RankBy.Ann("vector", new[] { 0.1f, 0.2f, 0.3f }), // Optional: include vector to combine with filters
        Limit = 10,
        IncludeAttributes = new List<string> { "title", "timestamp" },
    }
);

foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// Prints a list of row-oriented documents:
// {"$dist": 0.15, "id": 1, "timestamp": "2024-03-02T00:00:00.000000000Z", "title": "Getting Started Guide"}
// {"$dist": 0.28, "id": 2, "timestamp": "2024-03-03T00:00:00.000000000Z", "title": "Advanced Features"}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-filters-example-rb")

result = ns.query(
  filters: ["And", [
    ["timestamp", "Gte", DateTime.new(2024, 3, 1, 0, 0, 0)],  # Documents after March 1, 2024
    ["public", "Eq", true],
  ]],
  rank_by: ["vector", "ANN", [0.1, 0.2, 0.3]],  # Optional: include vector to combine with filters
  limit: 10,
  include_attributes: ["title", "timestamp"],
)
puts result.rows

# Prints a list of row-oriented documents:
# {id: 1, dist: 0.15, title: "Getting Started Guide", timestamp: '2024-03-02T00:00:000000000Z'}
# {id: 2, dist: 0.28, title: "Advanced Features", timestamp: '2024-03-03T00:00:000000000Z'}
```
<!-- /multilang -->

### Sparse vector search

You can use `SparseKNN` to rank by the distance between a sparse vector attribute and a sparse vector query. For example:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-sparse-vector-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["sparse_vector", "SparseKNN", {"dim0": 0.2, "dim3": 0.1}],
   "limit": 10
 }'
```
```python
# $ pip install turbopuffer
import turbopuffer
import os

tpuf = turbopuffer.Turbopuffer(
    # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    api_key=os.getenv("TURBOPUFFER_API_KEY"),
    # Pick the right region: https://turbopuffer.com/docs/regions
    region="gcp-us-central1",
)

ns = tpuf.namespace(f'query-sparse-vector-example-py')

# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
result = ns.query(
    rank_by=("sparse_vector", "SparseKNN", {"dim0": 0.2, "dim3": 0.1}),
    limit=10,
)
print(result.rows)
```
```typescript
// $ npm install @turbopuffer/turbopuffer
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`query-sparse-vector-example-ts`);

const result = await ns.query({
  rank_by: ["sparse_vector", "SparseKNN", { dim0: 0.2, dim3: 0.1 }],
  limit: 10,
});
console.log(result.rows);
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
		// API tokens are created in the dashboard: https://turbopuffer.com/dashboard
		option.WithAPIKey(os.Getenv("TURBOPUFFER_API_KEY")),
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-sparse-vector-example-go")

	// If an error occurs, this call raises an error if a retry was not successful.
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankBySparseKnn("sparse_vector", map[string]float64{"dim0": 0.2, "dim3": 0.1}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QuerySparseVector {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-sparse-vector-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.sparseKnn("sparse_vector", Map.of("dim0", 0.2, "dim3", 0.1)))
        .limit(10)
        .build()
    );
    System.out.println(result.rows().get());
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
    // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    // Loaded from TURBOPUFFER_API_KEY env var by default. Override if necessary:
    // ApiKey = "...",

    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("query-sparse-vector-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.SparseKnn(
            "sparse_vector",
            new Dictionary<string, double> { ["dim0"] = 0.2, ["dim3"] = 0.1 }
        ),
        Limit = 10,
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
```
```ruby
# $ gem install turbopuffer
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  api_key: ENV["TURBOPUFFER_API_KEY"],
  # Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
)

ns = tpuf.namespace("query-sparse-vector-example-rb")

# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
result = ns.query(
  rank_by: ["sparse_vector", "SparseKNN", { dim0: 0.2, dim3: 0.1 }],
  limit: 10,
)
puts result.rows
```
<!-- /multilang -->

`SparseKNN` is compatible with FTS operators: `Sum`, `Max`, `Saturate`, etc.

### Ordering by Attributes

You can specify a `rank_by` parameter to order results by a specific attribute (i.e. SQL `ORDER BY`). For example, to order by timestamp in descending order:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-ordering-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "filters": ["timestamp", "Lt", "2024-03-01T00:00:00.000Z"],
   "rank_by": ["timestamp", "desc"],
   "limit": 1000,
   "include_attributes": ["title", "timestamp"]
 }'
```
```python
from datetime import datetime
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-ordering-example-py')

result = ns.query(
    filters=('timestamp', 'Lt', datetime(2024, 3, 1, 0, 0, 0)),  # Documents before March 1, 2024
    rank_by=('timestamp', 'desc'),  # Order by timestamp in descending order
    limit=1000,
    include_attributes=['title', 'timestamp']
)
print(result.rows)

# Prints a list of row-oriented documents:
# [
#   Row(id=6, vector=None, title='Roadmap', timestamp='2024-02-27T00:00:000000000Z'),
#   Row(id=4, vector=None, title='Performance Guide', timestamp='2024-02-24T00:00:000000000Z'),
# ]
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-ordering-example-ts`);

const result = await ns.query({
  filters: ["timestamp", "Lt", new Date("2024-03-01").toISOString()], // Documents before March 1, 2024
  rank_by: ["timestamp", "desc"], // Order by timestamp in descending order
  limit: 1000,
  include_attributes: ["title", "timestamp"],
});

console.log(result.rows);
// Returns a row-oriented result:
// [
//   {id: 6, vector: null, title: "Roadmap", timestamp: "2024-02-27T00:00:000000000Z"},
//   {id: 4, vector: null, title: "Performance Guide", timestamp: "2024-02-24T00:00:000000000Z"}
// ]
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-ordering-example-go")

	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			Filters: turbopuffer.NewFilterLt("timestamp", time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC)), // Documents before March 1, 2024
			RankBy: turbopuffer.NewRankByAttribute("timestamp", turbopuffer.RankByAttributeOrderDesc), // Order by timestamp in descending order
			Limit: turbopuffer.LimitParam{
				Total: 1000,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"title", "timestamp"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))

	// Returns a row-oriented result:
	// [
	//   {"id": 6, "vector": null, "title": "Roadmap", "timestamp": "2024-02-27T00:00:000000000Z"},
	//   {"id": 4, "vector": null, "title": "Performance Guide", "timestamp": "2024-02-24T00:00:000000000Z"}
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.time.*;
import java.util.*;

public class QueryOrdering {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-ordering-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .filters(Filter.lt("timestamp", ZonedDateTime.of(2024, 3, 1, 0, 0, 0, 0, ZoneOffset.UTC))) // Documents before March 1, 2024
        .rankBy(RankBy.attribute("timestamp", RankByAttributeOrder.DESC)) // Order by timestamp in descending order
        .limit(1000)
        .includeAttributes("title", "timestamp")
        .build()
    );
    System.out.println(result.rows().get());
    // Prints a list of row-oriented documents:
    // [
    //   {id=6, vector=None, title='Roadmap', timestamp='2024-02-27T00:00:00'},
    //   {id=4, vector=None, title='Performance Guide', timestamp='2024-02-24T00:00:00'}
    // ]
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

var ns = tpuf.Namespace("query-ordering-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        Filters = Filter.Lt("timestamp", new DateTime(2024, 3, 1, 0, 0, 0, DateTimeKind.Utc)), // Documents before March 1, 2024
        RankBy = RankBy.Attribute("timestamp", RankByAttributeOrder.DESC), // Order by timestamp in descending order
        Limit = 1000,
        IncludeAttributes = new List<string> { "title", "timestamp" },
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// Prints a list of row-oriented documents:
// {"id": 6, "timestamp": "2024-02-27T00:00:00.000000000Z", "title": "Roadmap"}
// {"id": 4, "timestamp": "2024-02-24T00:00:00.000000000Z", "title": "Performance Guide"}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-ordering-example-rb")

result = ns.query(
  filters: ["timestamp", "Lt", DateTime.new(2024, 3, 1, 0, 0, 0)],  # Documents before March 1, 2024
  rank_by: ["timestamp", "desc"],  # Order by timestamp in descending order
  limit: 1000,
  include_attributes: ["title", "timestamp"],
)
puts result.rows

# Prints a list of row-oriented documents:
# {id: 6, dist: 0.15, title: "Roadmap", timestamp: '2024-03-02T00:00:000000000Z'}
# {id: 4, dist: 0.28, title: "Performance Guide", timestamp: '2024-03-03T00:00:000000000Z'}
```
<!-- /multilang -->

Ordering by multiple attributes isn't yet implemented.

Similar to SQL, the ordering of results is not guaranteed when multiple documents have the same attribute value for the `rank_by` parameter. Array attributes aren't supported.

Documents with a missing or `null` value for the `rank_by` attribute are sorted first in ascending order and last in descending order.

### Lookups

To find all documents matching filters when order isn't important to you, rank
by the `id` attribute, which is guaranteed to be present in every namespace:

```json
"filters": [...],
"rank_by": ["id", "asc"],
"limit": ...
```

If you expect more than `limit.total` results, see [Pagination](#pagination).

### Aggregations

Aggregations are still being optimized - we do not recommend using them for latency sensitive workloads on namespaces that exceed 1M documents in size.

You can aggregate attribute values across all documents in the namespace that
match the query's filters using the [aggregate_by
parameter](#param-aggregate_by).

For example, to count the number of documents in a namespace:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-count-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "aggregate_by": {
      "my_cool_count": ["Count"]
    },
    "filters": ["cool_score", "Gt", 7]
  }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-count-example-py')

result = ns.query(
    aggregate_by={'my_cool_count': ('Count',)},
    filters=('cool_score', 'Gt', 7),
)
print(result.aggregations['my_cool_count'])
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-count-example-ts`);

const result = await ns.query({
  aggregate_by: { my_cool_count: ["Count"] },
  filters: ["cool_score", "Gt", 7],
});
console.log(result.aggregations!.my_cool_count);
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

	ns := tpuf.Namespace("query-count-example-go")
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			AggregateBy: map[string]turbopuffer.AggregateBy{
				"my_cool_count": turbopuffer.NewAggregateByCount(),
			},
			Filters: turbopuffer.NewFilterGt("cool_score", 7),
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println(result.Aggregations["my_cool_count"])
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryCount {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-count-example-java");

    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .aggregateBy(Map.of("my_cool_count", AggregateBy.count("id")))
        .filters(Filter.gt("cool_score", 7))
        .build()
    );

    var aggregations = queryResult.aggregations().get();
    System.out.println(aggregations.get("my_cool_count"));
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

var ns = tpuf.Namespace("query-count-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        AggregateBy = new Dictionary<string, AggregateBy> { ["my_cool_count"] = AggregateBy.Count() },
        Filters = Filter.Gt("cool_score", 7),
    }
);

var aggregations = queryResult.GetAggregations();
Console.WriteLine(aggregations["my_cool_count"]);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-count-example-rb")

result = ns.query(
  aggregate_by: { my_cool_count: ["Count"] },
  filters: ["cool_score", "Gt", 7],
)
puts result.aggregations[:my_cool_count]
```
<!-- /multilang -->

You can use `Sum` to sum numeric attribute values across all documents that match
a particular filter:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-sum-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "aggregate_by": {
      "my_cool_sum": ["Sum", "cool_score"]
    },
    "filters": ["id", "Gte", 2]
  }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-sum-example-py')

result = ns.query(
    aggregate_by={'my_cool_sum': ('Sum', 'cool_score')},
    filters=('id', 'Gte', 2),
)
print(result.aggregations['my_cool_sum'])
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-sum-example-ts`);

const result = await ns.query({
  aggregate_by: { my_cool_sum: ["Sum", "cool_score"] },
  filters: ["id", "Gte", 2],
});
console.log(result.aggregations!.my_cool_sum);
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

	ns := tpuf.Namespace("query-sum-example-go")
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			AggregateBy: map[string]turbopuffer.AggregateBy{
				"my_cool_sum": turbopuffer.NewAggregateBySum("cool_score"),
			},
			Filters: turbopuffer.NewFilterGte("id", 2),
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println(result.Aggregations["my_cool_sum"])
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QuerySum {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-sum-example-java");

    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .aggregateBy(Map.of("my_cool_sum", AggregateBy.sum("cool_score")))
        .filters(Filter.gte("id", 2))
        .build()
    );

    var aggregations = queryResult.aggregations().get();
    System.out.println(aggregations.get("my_cool_sum"));
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

var ns = tpuf.Namespace("query-sum-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        AggregateBy = new Dictionary<string, AggregateBy> { ["my_cool_sum"] = AggregateBy.Sum("cool_score") },
        Filters = Filter.Gte("id", 2),
    }
);

var aggregations = queryResult.GetAggregations();
Console.WriteLine(aggregations["my_cool_sum"]);
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-sum-example-rb")

result = ns.query(
  aggregate_by: { my_cool_sum: ["Sum", "cool_score"] },
  filters: ["id", "Gte", 1],
)
puts result.aggregations[:my_cool_sum]
```
<!-- /multilang -->

### Group by

Aggregations are still being optimized - we do not recommend using them for latency sensitive workloads on namespaces that exceed 1M documents in size.

When [aggregating](#param-aggregate_by), you can use the
[group_by](#param-group_by) parameter to group results by one or more
attributes. Aggregates are computed separately for each group.

For example, to count documents grouped by the `color` and `size` attributes:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-group-by-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "aggregate_by": {
      "count_by_color_and_size": ["Count"]
    },
    "group_by": ["color", "size"]
  }'
# [
#   {"color": "blue", "count_by_color_and_size": 1,  "size": "XL"},
#   {"color": "red", "count_by_color_and_size": 2, "size": "L"}
# ]
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region="gcp-us-central1",  # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-group-by-example-py')

result = ns.query(
    aggregate_by={"count_by_color_and_size": ("Count",)},
    group_by=["color", "size"],
)
print(result.aggregation_groups)
# [
#   Row(color='blue', count_by_color_and_size=1, size='XL'),
#   Row(color='red', count_by_color_and_size=2, size='L')
# ]
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-group-by-example-ts`);

const result = await ns.query({
  aggregate_by: { count_by_color_and_size: ["Count"] },
  group_by: ["color", "size"],
});
console.log(result.aggregation_groups);
// [
//   { color: "blue", count_by_color_and_size: 1, size: "XL" },
//   { color: "red", count_by_color_and_size: 2, size: "L" },
// ]
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

	ns := tpuf.Namespace("query-group-by-example-go")
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			AggregateBy: map[string]turbopuffer.AggregateBy{
				"count_by_color_and_size": turbopuffer.NewAggregateByCount(),
			},
			GroupBy: []turbopuffer.GroupBy{
				turbopuffer.NewGroupByAttr("color"),
				turbopuffer.NewGroupByAttr("size"),
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println(turbopuffer.PrettyPrint(result.AggregationGroups))
	// [
	//   { color: "blue", count_by_color_and_size: 1, size: "XL" },
	//   { color: "red", count_by_color_and_size: 2, size: "L" },
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryGroupBy {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-group-by-example-java");

    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .aggregateBy(Map.of("count_by_color_and_size", AggregateBy.count()))
        .groupBy(List.of(GroupBy.attr("color"), GroupBy.attr("size")))
        .build()
    );

    var aggregationGroups = queryResult.aggregationGroups().get();
    System.out.println(aggregationGroups);
    // [
    //   {color=blue, count_by_color_and_size=1, size=XL},
    //   {color=red, count_by_color_and_size=2, size=L}
    // ]
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

var ns = tpuf.Namespace("query-group-by-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        AggregateBy = new Dictionary<string, AggregateBy>
        {
            ["count_by_color_and_size"] = AggregateBy.Count(),
        },
        GroupBy = [GroupBy.Attr("color"), GroupBy.Attr("size")],
    }
);

foreach (var group in queryResult.GetAggregationGroups())
{
    Console.WriteLine(group);
}
// Prints a list of aggregation groups:
// { "size": "XL", "count_by_color_and_size": 1, "color": "blue" }
// { "size": "L", "count_by_color_and_size": 2, "color": "red" }
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-group-by-example-rb")

result = ns.query(
  aggregate_by: { count_by_color_and_size: ["Count"] },
  group_by: ["color", "size"],
)
puts result.aggregation_groups
# {color: "blue", count_by_color_and_size: 1, size: "XL"}
# {color: "red", count_by_color_and_size: 2, size: "L"}
```
<!-- /multilang -->

You can use the `ForEachUnique` operator to explode array attributes when
grouping. This creates a separate group for each unique element of the array.

For example, if documents have a `tags` array attribute with values like
`["electronics", "mobile"]`, using the `ForEachUnique` operator will create
separate groups for `electronics` and `mobile`:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-group-by-for-each-unique-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "aggregate_by": {
      "count_by_tag": ["Count"]
    },
    "group_by": [
      {"tag": ["ForEachUnique", "tags"]}
    ]
  }'
# [
#   {"tag": "electronics", "count_by_tag": 2},
#   {"tag": "mobile", "count_by_tag": 1}
# ]
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region="gcp-us-central1",  # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-group-by-for-each-unique-example-py')

result = ns.query(
    aggregate_by={"count_by_tag": ("Count",)},
    group_by=[{"tag": ("ForEachUnique", "tags")}],
)
print(result.aggregation_groups)
# [
#   Row(tag='electronics', count_by_tag=2),
#   Row(tag='mobile', count_by_tag=1),
# ]
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-group-by-for-each-unique-example-ts`);

const result = await ns.query({
  aggregate_by: { count_by_tag: ["Count"] },
  group_by: [{ tag: ["ForEachUnique", "tags"] }],
});
console.log(result.aggregation_groups);
// [
//   { tag: "electronics", count_by_tag: 2 },
//   { tag: "mobile", count_by_tag: 1 },
// ]
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

	ns := tpuf.Namespace("query-group-by-for-each-unique-example-go")
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			AggregateBy: map[string]turbopuffer.AggregateBy{
				"count_by_tag": turbopuffer.NewAggregateByCount(),
			},
			GroupBy: []turbopuffer.GroupBy{
				turbopuffer.NewGroupByExpr("tag", turbopuffer.NewGroupByFunctionForEachUnique("tags")),
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Println(turbopuffer.PrettyPrint(result.AggregationGroups))
	// [
	//   { tag: "electronics", count_by_tag: 2 },
	//   { tag: "mobile", count_by_tag: 1 },
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryGroupByForEachUnique {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace(
      "query-group-by-for-each-unique-example-java"
    );

    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .aggregateBy(Map.of("count_by_tag", AggregateBy.count()))
        .groupBy(List.of(GroupBy.expr("tag", GroupByFunction.forEachUnique("tags"))))
        .build()
    );

    var aggregationGroups = queryResult.aggregationGroups().get();
    System.out.println(aggregationGroups);
    // [
    //   {count_by_tag=2, tag=electronics},
    //   {count_by_tag=1, tag=mobile}
    // ]
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

var ns = tpuf.Namespace("query-group-by-for-each-unique-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        AggregateBy = new Dictionary<string, AggregateBy>
        {
            ["count_by_tag"] = AggregateBy.Count(),
        },
        GroupBy = [GroupBy.Expr("tag", GroupByFunction.ForEachUnique("tags"))],
    }
);

foreach (var group in queryResult.GetAggregationGroups())
{
    Console.WriteLine(group);
}
// Prints a list of aggregation groups:
// { "count_by_tag": 2, "tag": "electronics" }
// { "count_by_tag": 1, "tag": "mobile" }
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-group-by-for-each-unique-example-rb")

result = ns.query(
  aggregate_by: { count_by_tag: ["Count"] },
  group_by: [{ tag: ["ForEachUnique", "tags"] }],
)
puts result.aggregation_groups
# {tag: "electronics", count_by_tag: 2}
# {tag: "mobile", count_by_tag: 1}
```
<!-- /multilang -->

You can also combine `ForEachUnique` with regular grouping attributes:

```jsonc
{
  "aggregate_by": {"count_by_tag_and_status": ["Count"]},
  "group_by": [
    {"tag": ["ForEachUnique", "tags"]},
    "status"
  ]
}
```

This query returns aggregation groups for each combination of `tag` and
`status`.

### Multi-queries

You can provide multiple query objects to be executed simultaneously on a namespace.
Individual subqueries can be one of any other primitive query type, simplifying complex retrieval workflows. Multi-queries offer better performance than issuing independent queries to the same namespace.

All reads in a multi-query are executed against the same consistent snapshot of
the database (snapshot isolation).

Up to 16 queries can be sent per request.
Each subquery will count against the [concurrent query limit](/docs/limits) for
the namespace. If you need a higher limit, please [contact us](/contact).

For example, a standard hybrid query combining full-text and vector searches executed together through a multi-query:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-multi-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "queries": [
    {
      "rank_by": ["vector", "ANN", [1.0, 0.0]],
      "limit": 1
    },
    {
      "rank_by": ["attr1", "BM25", "quick fox"],
      "limit": 1
    }
  ]
 }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region="gcp-us-central1",  # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-multi-example-py')

response = ns.multi_query(
    queries=[
        {
            "rank_by": ("vector", "ANN", [1.0, 0.0]),
            "limit": 1
        },
        {
            "rank_by": ("attr1", "BM25", "quick fox"),
            "limit": 1,
        },
    ]
)
print(response.results)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-multi-example-ts`);

const result = await ns.multiQuery({
  queries: [
    {
      rank_by: ["vector", "ANN", [1.0, 0.0]],
      limit: 1,
    },
    {
      rank_by: ["attr1", "BM25", "quick fox"],
      limit: 1,
    }
  ]
});
console.log(result.results);
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

	ns := tpuf.Namespace("query-multi-example-go")

	result, err := ns.MultiQuery(
		ctx,
		turbopuffer.NamespaceMultiQueryParams{
			Queries: []turbopuffer.QueryParam{
				{
					RankBy: turbopuffer.NewRankByAnn("vector", []float32{1.0, 0.0}),
					Limit: turbopuffer.LimitParam{
						Total: 1,
					},
				},
				{
					RankBy: turbopuffer.NewRankByTextBM25("attr1", "quick fox"),
					Limit: turbopuffer.LimitParam{
						Total: 1,
					},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Results))
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryMulti {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-multi-example-java");

    var response = ns.multiQuery(
      NamespaceMultiQueryParams.builder()
        .addQuery(
          Query.builder().rankBy(RankBy.ann("vector", List.of(1.0f, 0.0f))).limit(1).build()
        )
        .addQuery(Query.builder().rankBy(RankByText.bm25("attr1", "quick fox")).limit(1).build())
        .build()
    );
    System.out.println(response.results());
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

var ns = tpuf.Namespace("query-multi-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var response = await ns.MultiQuery(
    new NamespaceMultiQueryParams
    {
        Queries =
        [
            new Query { RankBy = RankBy.Ann("vector", new[] { 1.0f, 0.0f }), Limit = 1 },
            new Query { RankBy = RankByText.BM25("attr1", "quick fox"), Limit = 1 },
        ],
    }
);
foreach (var result in response.Results)
{
    foreach (var row in result.GetRows())
    {
        Console.WriteLine(row);
    }
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-multi-example-rb")

response = ns.multi_query(
  queries: [
    {
      rank_by: ["vector", "ANN", [1.0, 0.0]],
      limit: 1,
    },
    {
      rank_by: ["attr1", "BM25", "quick fox"],
      limit: 1,
    },
  ],
)
puts response.results
```
<!-- /multilang -->

Individual sub-queries can vary their parameters independently including different `filters`, `limit`, `rank_by` or `aggregate_by`.

The `consistency` parameter must be set at the root level of the request, not on individual sub-queries. All sub-queries in a multi-query share the same consistency level.

## Full-Text Search

The FTS attribute must be configured with `full_text_search` set in the schema
when writing documents. See [Schema documentation](/docs/write#schema) and
the [Full-Text Search guide](/docs/fts) for more details.

For an example of hybrid search (combining both vector and BM25 results), see
[Hybrid Search](/docs/hybrid-search).

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-fts-basic-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["content", "BM25", "quick fox"],
   "limit": 10,
   "include_attributes": ["title", "content"]
 }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-fts-basic-example-py')

result = ns.query(
    rank_by=('content', 'BM25', 'quick fox'),
    limit=10,
    include_attributes=['title', 'content']
)
print(result.rows)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-fts-basic-example-ts`);

const result = await ns.query({
  rank_by: ["content", "BM25", "quick fox"],
  limit: 10,
  include_attributes: ["title", "content"],
});
console.log(result.rows);
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

	ns := tpuf.Namespace("query-fts-basic-example-go")

	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByTextBM25("content", "quick fox"),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"title", "content"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryFtsBasic {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-fts-basic-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", "quick fox"))
        .limit(10)
        .includeAttributes("title", "content")
        .build()
    );
    System.out.println(result.rows().get());
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

var ns = tpuf.Namespace("query-fts-basic-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", "quick fox"),
        Limit = 10,
        IncludeAttributes = new List<string> { "title", "content" },
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-fts-basic-example-rb")

result = ns.query(
  rank_by: ["content", "BM25", "quick fox"],
  limit: 10,
  include_attributes: ["title", "content"],
)
puts result.rows
```
<!-- /multilang -->

You can combine BM25 full-text search with filters to limit results to
a specific subset of documents.

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/fts-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["content", "BM25", "quick fox"],
   "filters": ["And", [
     ["timestamp", "Gte", "2024-03-01T00:00:00.000Z"],
     ["public", "Eq", true]
   ]],
   "limit": 10,
   "include_attributes": ["title", "content", "timestamp"]
 }'
```
```python
from datetime import datetime
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-fts-example-py')

result = ns.query(
    rank_by=('content', 'BM25', 'quick fox'),
    filters=('And', (
        ('timestamp', 'Gte', datetime(2024, 3, 1, 0, 0, 0)),  # Documents after March 1, 2024
        ('public', 'Eq', True),
    )),
    limit=10,
    include_attributes=['title', 'content', 'timestamp']
)
print(result.rows)

# Prints a list of row-oriented documents:
# [
#   Row(id=1, vector=None, $dist=0.85, title='Animal Stories', content='The quick brown fox...', timestamp='2024-03-02T00:00:000000000Z'),
#   Row(id=2, vector=None, $dist=1.28, title='Forest Tales', content='A quick red fox...', timestamp='2024-03-03T00:00:000000000Z'),
# ]
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-fts-example-ts`);

const result = await ns.query({
  rank_by: ["content", "BM25", "quick fox"],
  filters: [
    "And",
    [
      ["timestamp", "Gte", new Date("2024-03-01").toISOString()], // Documents after March 1, 2024
      ["public", "Eq", true],
    ],
  ],
  limit: 10,
  include_attributes: ["title", "content", "timestamp"],
});

console.log(result.rows);
// Returns a row-oriented result:
// [
//   {id: 1, vector: null, title: "Animal Stories", content: "The quick brown fox...", timestamp: "2024-03-02T00:00:000000000Z", $dist: 0.85},
//   {id: 2, vector: null, title: "Forest Tales", content: "A quick red fox...", timestamp: "2024-03-03T00:00:000000000Z", $dist: 1.28}
// ]
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-fts-example-go")

	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByTextBM25("content", "quick fox"),
			Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				turbopuffer.NewFilterGte("timestamp", time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC)), // Documents after March 1, 2024
				turbopuffer.NewFilterEq("public", true),
			}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"title", "content", "timestamp"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))
	// Returns a row-oriented result:
	// [
	//   {"id": 1, "vector": null, "title": "Animal Stories", "content": "The quick brown fox...", "timestamp": "2024-03-02T00:00:000000000Z", "$dist": 0.85},
	//   {"id": 2, "vector": null, "title": "Forest Tales", "content": "A quick red fox...", "timestamp": "2024-03-03T00:00:000000000Z", "$dist": 1.28}
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.time.*;
import java.util.*;

public class QueryFts {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-fts-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", "quick fox"))
        .filters(
          Filter.and(
            Filter.gte("timestamp", ZonedDateTime.of(2024, 3, 1, 0, 0, 0, 0, ZoneOffset.UTC)), // Documents after March 1, 2024
            Filter.eq("public", true)
          )
        )
        .limit(10)
        .includeAttributes("title", "content", "timestamp")
        .build()
    );

    System.out.println(result.rows().get());
    // Prints a list of row-oriented documents:
    // [
    //   {id=1, vector=None, $dist=0.85, title='Animal Stories', content='The quick brown fox...', timestamp='2024-03-02T00:00:00'},
    //   {id=2, vector=None, $dist=1.28, title='Forest Tales', content='A quick red fox...', timestamp='2024-03-03T00:00:00'}
    // ]
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

var ns = tpuf.Namespace("query-fts-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", "quick fox"),
        Filters = Filter.And(
            Filter.Gte("timestamp", new DateTime(2024, 3, 1, 0, 0, 0, DateTimeKind.Utc)), // Documents after March 1, 2024
            Filter.Eq("public", true)
        ),
        Limit = 10,
        IncludeAttributes = new List<string> { "title", "content", "timestamp" },
    }
);

foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// Prints a list of row-oriented documents:
// {"$dist": 0.85, "id": 1, "content": "The quick brown fox...", "timestamp": "2024-03-02T00:00:00.000000000Z", "title": "Animal Stories"}
// {"$dist": 1.28, "id": 2, "content": "A quick red fox...", "timestamp": "2024-03-03T00:00:00.000000000Z", "title": "Forest Tales"}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-fts-example-rb")

result = ns.query(
  rank_by: ["content", "BM25", "quick fox"],
  filters: ["And", [
    ["timestamp", "Gte", DateTime.new(2024, 3, 1, 0, 0, 0)],  # Documents after March 1, 2024
    ["public", "Eq", true],
  ]],
  limit: 10,
  include_attributes: ["title", "content", "timestamp"],
)
puts result.rows

# Prints a list of row-oriented documents:
# {id: 1, dist: 0.85, title: "Animal Stories", content: "The quick brown fox...", timestamp: '2024-03-02T00:00:000000000Z'}
# {id: 2, dist: 1.28, title: "Forest Tales", content: "A quick red fox...", timestamp: '2024-03-03T00:00:000000000Z'}
```
<!-- /multilang -->

### FTS operators

FTS operators combine the results of multiple clauses into a single score. Specifically, the following operators are supported:

- `Sum`: Sum the scores of the clauses.
- `Max`: Use the maximum score of clauses as the score.

Operators can be nested. For example:

```json
"rank_by": ["Sum", [
  ["Max", [
    ["title", "BM25", "whale facts"],
    ["description", "BM25", "whale facts"]
  ]],
  ["content", "BM25", "huge whale"]
]]
```

### Field weights/boosts

You can specify a weight / boost per-field by using the `Product` operator inside a `rank_by`.
For example, to apply a 2x score multiplier on the `title` clause:

```json
"rank_by": ["Sum", [
  ["Product", 2, ["title", "BM25", "quick fox"]],
  ["content", "BM25", "quick fox"]
]]
```

Note that the weight must be non-negative.

### Rank by filter

[Filters](#filtering) can be used inside `rank_by` expressions to conditionally boost documents matching certain criteria. Documents that pass the filter get a score of 1, and are otherwise scored 0.

```json
"rank_by": ["Sum", [
  ["title", "BM25", "quick fox"],
  ["species", "Eq", "whale"]
]]
```

Use `Product` to change how large the boost is:

```json
"rank_by": ["Product", 2.0, ["species", "Eq", "whale"]]
```

### Rank by attribute

You can use attribute values from your documents to influence ranking by using
the `Attribute` operator.

For instance, to rank by the sum of the BM25 score and the value of an
attribute named `clicks`:

```json
"rank_by": ["Sum", [
  ["title", "BM25", "quick fox"],
  ["Max", 0, ["Attribute", "clicks"]]
]]
```

Scores have to be non-negative for best performance. turbopuffer will reject
`Attribute` operators applied on signed types such as int and float without the
Max operator.

The above ranking function will generally not give good relevance since BM25
scores and the `clicks` attribute have hardly comparable distributions. It is
possible to improve it by using the `Saturate` operator, which maps
non-negative values into `[0, 1)` through the following function: `Saturate(x)
= x^exponent / (x^exponent + midpoint^exponent)` where
 - `midpoint` is a required parameter that controls the input value that
   gives 0.5. The function grows slower and slower after this point.
 - `exponent` (default: 1) is a second-order tuning parameter that helps
   further tune how quickly the function grows.

`Saturate` implicitly takes the max of attribute values with zero, so wrapping 
the `Attribute` operator under a `Max` is not needed.

![saturate_plot.svg](/images/saturate_plot.svg)

Think of `Saturate` as the counterpart of BM25, but for numeric attributes
rather than text, something that turns numeric values into scores that can be
combined with other scores - such as BM25 scores - through a weighted linear
combination. See how the below example uses `Product` to set a weight of 1.7 on
the contribution of the `clicks` attribute:

```json
"rank_by": ["Sum", [
  ["title", "BM25", "quick fox"],
  ["Product", 1.7, ["Saturate", ["Attribute", "clicks"], { "midpoint": 100 }]]
]]
```

A difference though is that BM25 takes advantage of the fact that text data
usually follows the same pattern to come with good defaults for the weight and
`midpoint` of the score contribution of each term, while you are responsible
for providing this information for attributes. We recommend vibe-tuning the
`midpoint` and weights to begin with against simple queries you test yourself,
and setting up more robust evals later. We intend to write more about how to
set up search evals soon, for now, ask your favourite LLM.
 - As long as your weight stays in [1, 3], you should be relatively safe as
   your attribute will have score contributions of the same order as a term
   that occurs in 40% of documents or more. So if your BM25 query includes rare
   terms, BM25 will still drive the ordering of hits.
 - Good values for `midpoint` are usually close to the lower end of the value
   range. For instance, BM25 configures a `midpoint` of 1.2 by default (the
   `k1` parameter) for the contribution of the term frequency (the number of
   occurrences of the term in the document) to the score.
 - Leave `exponent` to its default value of 1 until you have evals to tune it.

Sometimes, attributes correlate inversely with relevance, e.g. a
`number_of_negative_reviews` attribute where higher values make a document less
relevant. In such cases, one should swap the `Saturate` operator with the
`Decay` operator, which takes the same configuration parameters and is
implemented as `Decay(x) = midpoint^exponent / (x^exponent +
midpoint^exponent)`.

![decay_plot.svg](/images/decay_plot.svg)

```json
"rank_by": ["Sum", [
  ["title", "BM25", "quick fox"],
  ["Decay", ["Attribute", "number_of_negative_reviews"], { "midpoint": 2 }]
]]
```

### Rank by distance

The `Dist` operator can be used to boost by the distance between an origin
point and an attribute value. The returned distance is typically passed to the
`Decay` operator, then summed with BM25 scores. For instance, to boost by
recency (time distance):

```json
"rank_by": ["Sum", [
  ["title", "BM25", "quick fox"],
  ["Decay", ["Dist", ["Attribute", "published_at"], "2026-02-03T12:13:14"], { "midpoint": "6h" }]
]]
```

When used on a `datetime` field, the `midpoint` can be provided either as a
number of milliseconds, or as a duration string. Supported units include `s`
(seconds), `m` (minutes), `h` (hours), `d` (days) and `w` (weeks).

### Phrase matching

`ContainsTokenSequence` matches documents that contain all the tokens present in the filter input string, in the exact order and adjacent to each other.

```json
"filters": ["text", "ContainsTokenSequence", "walrus is lazy"]
```

Currently, turbopuffer implements `ContainsTokenSequence` using a partial postfilter which may lead to reduced recall on ANN queries, and potentially higher latency on filter-only and FTS queries; we expect to improve this in the future.

`ContainsAllTokens` matches documents that contain all the tokens present in the filter input string, regardless of order or adjacency. For example, this filter would match a document like "walrus is lazy", provided said document didn't contain both "polar" and "bear":

```json
"filters": ["And", [
  ["text", "ContainsAllTokens", "lazy walrus"],
  ["Not", ["text", "ContainsAllTokens", "polar bear"]]
]]
```

`ContainsAllTokens` is generally faster than `ContainsTokenSequence`.

### Prefix queries

Type-ahead style prefix queries are supported through the `ContainsAllTokens` filter, `ContainsAnyToken` filter, and the `BM25` ranking operator using the `last_as_prefix` parameter:

```jsonc
// As a filter (matching all tokens)
"filters": ["text", "ContainsAllTokens", "lazy wal", { "last_as_prefix": true }]

// As a filter (matching any token)
"filters": ["text", "ContainsAnyToken", "lazy wal", { "last_as_prefix": true }]

// Within a BM25 query
"rank_by": ["text", "BM25", "lazy wal", { "last_as_prefix": true }]
```

When `last_as_prefix` is true, the last token in the input string is treated as a literal prefix. In this case, the prefix
"wal" matches documents that contain "wal", "walrus", "walnut", etc. `BM25` prefix matches are assigned a score of `1.0`.

## Filtering

Filters allow you to narrow down results by applying exact conditions to
attributes. Conditions are arrays with an attribute name, operation, and value,
for example:

- `["attr_name", "Eq", 42]`
- `["page_id", "In", ["page1", "page2"]]`
- `["user_migrated_at", "NotEq", null]`

Values must have the same type as the attribute's value, or an array of that type for operators like `ContainsAny`.

Filters are evaluated against an inverted index, which makes even large
intersects fast. turbopuffer's [filtering is recall-aware for vector
queries](/blog/native-filtering).

Conditions can be combined using `{And,Or}` operations:

```json
// basic And condition
"filters": ["And", [
  ["attr_name", "Eq", 42],
  ["page_id", "In", ["page1", "page2"]]
]]

// conditions can be nested
"filters": ["And", [
  ["page_id", "In", ["page1", "page2"]],
  ["Or", [
    ["public", "Eq", 1],
    ["permission_id", "In", ["3iQK2VC4", "wzw8zpnQ"]]
  ]]
]]
```

Filters can also be applied to the `id` field, which refers to the document ID.

### Filtering Parameters

**And** array[filter]

Matches if all of the filters match.

**Or** array[filter]

Matches if at least one of the filters matches.

**Not** filter

Matches if the filter does not match.

---
**Eq** id or value

Exact match for `id` or `attributes` values. If value is `null`, matches documents missing the attribute.

**NotEq** value

Inverse of `Eq`, for `attributes` values. If value is `null`, matches documents with the attribute.

---
**In** array[value]

Matches any `attributes` values contained in the provided list.

**NotIn** array[value]

Inverse of `In`, matches any `attributes` values not contained in the provided list.

---
**Contains** value

Checks whether the selected array attribute contains the provided value

**NotContains** value

Inverse of Contains

**ContainsAny** array[value]

Checks whether the selected array attribute contains any of the values provided (intersection filter)

**NotContainsAny** array[value]

Inverse of ContainsAny

---
**Lt** value

For ints, this is a numeric less-than on `attributes` values. For strings, lexicographic less-than. For datetimes, numeric less-than on millisecond representation. Note that this matches `null` attribute values unless the value passed to `Lt` is `null` itself.

**Lte** value

For ints, this is a numeric less-than-or-equal on `attributes` values. For strings, lexicographic less-than-or-equal. For datetimes, numeric less-than-or-equal on millisecond representation. Note that this matches `null` attribute values.

**Gt** value

For ints, this is a numeric greater-than on `attributes` values. For strings, lexicographic greater-than. For datetimes, numeric greater-than on millisecond representation.

**Gte** value

For ints, this is a numeric greater-than-or-equal on `attributes` values. For strings, lexicographic greater-than-or-equal. For datetimes, numeric greater-than-or-equal on millisecond representation.

---
**AnyLt** value

Checks whether any element of an array attribute is less than the provided value, using the same rules as [`Lt`](#param-Lt).

**AnyLte** value

Checks whether any element of an array attribute is less than or equal to the provided value, using the same rules as [`Lte`](#param-Lte).

**AnyGt** value

Checks whether any element of an array attribute is greater than the provided value, using the same rules as [`Gt`](#param-Gt).

**AnyGte** value

Checks whether any element of an array attribute is greater than or equal to the provided value, using the same rules as [`Gte`](#param-Gte).

---
**Glob** globset

Unix-style glob match against `string` or `[]string` attribute values. The full syntax is described in the [globset](https://docs.rs/globset/latest/globset/#syntax) documentation.

Requires the [glob](/docs/write#param-glob) (or for backwards compatibility, [filterable](/docs/write#param-filterable)) schema attribute to be enabled before use.

**NotGlob** globset

Inverse of `Glob`, Unix-style glob filters against `string` or `[]string` attribute values. The full syntax is described in the [globset](https://docs.rs/globset/latest/globset/#syntax) documentation.

Requires the [glob](/docs/write#param-glob) (or for backwards compatibility, [filterable](/docs/write#param-filterable)) schema attribute to be enabled before use.

**IGlob** globset

Case insensitive version of `Glob`.

**NotIGlob** globset

Case insensitive version of `NotGlob`.

---
**Regex** string

Regular expression match against `string` attribute values. Requires the [regex schema attribute](/docs/write#param-regex) to be enabled before use.

  **Warning:** Doesn't support certain advanced features (e.g. look-around, backreferences).

---
**Fuzzy** string

Fuzzy substring match against `string` or `[]string` attribute values. Requires the [fuzzy schema attribute](/docs/write#param-fuzzy) to be enabled before use.

  `max_edit_distance` (required) sets how many edits to tolerate by the query length in characters (uses [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)). `distance` can be `0`, `1`, or `2`, and `min_query_chars` must be at least 3 · (`distance` + 1). Queries shorter than the first `min_query_chars` threshold return no matches.

  ```jsonc
  {
    // Will match substrings within edit distance 1, since query has >= 6 chars.
    // If query was < 3 chars, would match nothing.
    "filters": ["company_name", "Fuzzy", "turbopufer", { "max_edit_distance": [
      {"min_query_chars": 3, "distance": 0},
      {"min_query_chars": 6, "distance": 1}
    ]}]
  }
  ```

---
**ContainsAllTokens** string

Matches documents that contain all the tokens present in the filter input string. If you need tokens to be adjacent and in order, use `ContainsTokenSequence` instead. See [phrase matching](#phrase-matching) for usage examples.

    Requires that the attribute is configured for [full-text search](/docs/fts).

    Supports [prefix queries](#prefix-queries) by providing an options object as the fourth parameter with `"last_as_prefix": true`.  Prefixes match using byte representations, e.g. "🧑" is a prefix of "🧑‍💻".

---
**ContainsTokenSequence** string

Matches documents that contain all the tokens present in the
  input string, in the exact order and adjacent to each other. See [phrase matching](#phrase-matching) for usage examples.

   Requires that the attribute is configured for [full-text search](/docs/fts).

---
**ContainsAnyToken** string

Matches documents that contain any of the tokens present in the filter input string.

    Requires that the attribute is configured for [full-text search](/docs/fts).

    Supports [prefix queries](#prefix-queries) in the same way as `ContainsAllTokens`.

### Complex Example

Using nested `And` and `Or` filters:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-complex-filter-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["vector", "ANN", [0.1, 0.1]],
   "limit": 10,
   "exclude_attributes": ["vector", "filename"],
   "filters": ["And", [
     ["id", "In", [1, 2, 3]],
     ["key1", "Eq", "one"],
     ["filename", "NotGlob", "/vendor/**"],
     ["Or", [
       ["filename", "Glob", "**.tsx"],
       ["filename", "Glob", "**.js"]
     ]]
   ]]
 }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-complex-filter-example-py')

# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
result = ns.query(
    rank_by=("vector", "ANN", [0.1, 0.1]),
    limit=10,
    exclude_attributes=["vector", "filename"],
    filters=('And', (
        ('id', 'In', [1, 2, 3]),
        ('key1', 'Eq', 'one'),
        ('filename', 'NotGlob', '/vendor/**'),
        ('Or', [
            ('filename', 'Glob', '**.tsx'),
            ('filename', 'Glob', '**.js'),
        ]),
    ))
)
print(result.rows) # Returns a row-oriented VectorResult
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-complex-filter-example-ts`);

const result = await ns.query({
  rank_by: ["vector", "ANN", [0.1, 0.1]],
  limit: 10,
  exclude_attributes: ["vector", "filename"],
  filters: [
    "And",
    [
      ["id", "In", [1, 2, 3]],
      ["key1", "Eq", "one"],
      ["filename", "NotGlob", "/vendor/**"],
      [
        "Or",
        [
          ["filename", "Glob", "**.tsx"],
          ["filename", "Glob", "**.js"],
        ],
      ],
    ],
  ],
});
console.log(result.rows);
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

	ns := tpuf.Namespace("query-complex-filter-example-go")

	// If an error occurs, this call raises an error if a retry was not successful.
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByAnn("vector", []float32{0.1, 0.1}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			ExcludeAttributes: []string{"vector", "filename"},
			Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				turbopuffer.NewFilterIn("id", []int{1, 2, 3}),
				turbopuffer.NewFilterEq("key1", "one"),
				turbopuffer.NewFilterNotGlob("filename", "/vendor/**"),
				turbopuffer.NewFilterOr([]turbopuffer.Filter{
					turbopuffer.NewFilterGlob("filename", "**.tsx"),
					turbopuffer.NewFilterGlob("filename", "**.js"),
				}),
			}),
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows)) // Returns a row-oriented result
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryComplexFilter {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-complex-filter-example-java");

    // If an error occurs, this call raises a TurbopufferServiceException if a
    // retry was not successful.
    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.ann("vector", List.of(0.1f, 0.1f)))
        .limit(10)
        .excludeAttributes(List.of("vector", "filename"))
        .filters(
          Filter.and(
            Filter.in("id", List.of(1, 2, 3)),
            Filter.eq("key1", "one"),
            Filter.notGlob("filename", "/vendor/**"),
            Filter.or(Filter.glob("filename", "**.tsx"), Filter.glob("filename", "**.js"))
          )
        )
        .build()
    );
    System.out.println(queryResult.rows().get());
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

var ns = tpuf.Namespace("query-complex-filter-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// If an error occurs, this call raises a TurbopufferApiException if a
// retry was not successful.
var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Ann("vector", new[] { 0.1f, 0.1f }),
        Limit = 10,
        ExcludeAttributes = new List<string> { "vector", "filename" },
        Filters = Filter.And(
            Filter.In("id", new[] { 1, 2, 3 }),
            Filter.Eq("key1", "one"),
            Filter.NotGlob("filename", "/vendor/**"),
            Filter.Or(Filter.Glob("filename", "**.tsx"), Filter.Glob("filename", "**.js"))
        ),
    }
);
foreach (var row in queryResult.GetRows())
{
    Console.WriteLine(row);
}
// Returns a row-oriented result
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-complex-filter-example-rb")

# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
result = ns.query(
  rank_by: ["vector", "ANN", [0.1, 0.1]],
  limit: 10,
  exclude_attributes: ["vector", "filename"],
  filters: ["And", [
    ["id", "In", [1, 2, 3]],
    ["key1", "Eq", "one"],
    ["filename", "NotGlob", "/vendor/**"],
    ["Or", [
      ["filename", "Glob", "**.tsx"],
      ["filename", "Glob", "**.js"],
    ]],
  ]],
)
puts result.rows # Returns a row-oriented result
```
<!-- /multilang -->

## Diversification

The [limit.per](#param-limit) parameter is a simple mechanism for increasing the
diversity of results. For example, to ensure that no category appears more than
five times in the results:

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-limit-per-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["id", "asc"],
   "filters": ["product_name", "ContainsAllTokens", "red cotton"],
   "limit": {
     "per": {"attributes": ["category"], "limit": 5},
     "total": 50
   },
   "include_attributes": ["category"]
 }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-limit-per-example-py')

result = ns.query(
    rank_by=('id', 'asc'),
    filters=('product_name', 'ContainsAllTokens', 'red cotton'),
    # No more than 5 docs per category
    limit={
        'per': {'attributes': ['category'], 'limit': 5},
        'total': 50,
    },
    include_attributes=['category'],
)
print(result.rows)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-limit-per-example-ts`);

const result = await ns.query({
  rank_by: ["id", "asc"],
  filters: ["product_name", "ContainsAllTokens", "red cotton"],
  // No more than 5 docs per category
  limit: {
    per: { attributes: ["category"], limit: 5 },
    total: 50,
  },
  include_attributes: ["category"],
});

console.log(result.rows);
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

	ns := tpuf.Namespace("query-limit-per-example-go")

	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy:  turbopuffer.NewRankByAttribute("id", turbopuffer.RankByAttributeOrderAsc),
			Filters: turbopuffer.NewFilterContainsAllTokens("product_name", "red cotton"),
			// No more than 5 docs per category
			Limit: turbopuffer.LimitParam{
				Total: 50,
				Per: turbopuffer.LimitPerParam{
					Attributes: []string{"category"},
					Limit:      5,
				},
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"category"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryLimitPer {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-limit-per-example-java");

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
        .filters(Filter.containsAllTokens("product_name", "red cotton"))
        // No more than 5 docs per category
        .limit(
          Limit.builder()
            .total(50L)
            .per(Limit.Per.builder().attributes(List.of("category")).limit(5L).build())
            .build()
        )
        .includeAttributes("category")
        .build()
    );
    System.out.println(result.rows().get());
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

var ns = tpuf.Namespace("query-limit-per-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
        Filters = Filter.ContainsAllTokens("product_name", "red cotton"),
        // No more than 5 docs per category
        Limit = new NamespaceLimit
        {
            Total = 50,
            Per = new Per { Attributes = new List<string> { "category" }, Limit = 5 },
        },
        IncludeAttributes = new List<string> { "category" },
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-limit-per-example-rb")

result = ns.query(
  rank_by: ["id", "asc"],
  filters: ["product_name", "ContainsAllTokens", "red cotton"],
  # No more than 5 docs per category
  limit: {
    per: { attributes: ["category"], limit: 5 },
    total: 50,
  },
  include_attributes: ["category"],
)
puts result.rows
```
<!-- /multilang -->

## Pagination

For full-text and vector search, you have two main options. If you're letting
your users paginate through hits with an infinite scrolling experience, the
best option is to create a filter that excludes IDs that have already been
rendered. This preserves a smooth user experience in the case when a write
operation changes the top hits of the query after the first page is retrieved.

```json
{
  "limit": 20,
  "rank_by": [...],
  "filters": ["id", "NotIn", [...]]
}
```

If you're letting users jump to arbitrary page numbers, pass a larger `limit`
value and ignore hits which belong to previous pages. This is what other
searches engines do internally when you pass an offset, which we have not
exposed yet. In case your users use pagination heavily, you may want to request
a large number of hits in the first place, cache them, and implement pagination
on the client side.

When [Ordering by Attributes](#ordering-by-attributes), you can page through
results by advancing a filter on the order attribute. For example, to paginate
by ID, advance a greater-than filter on ID:

<!-- multilang -->
```python
from datetime import datetime
import turbopuffer
from turbopuffer.types import Filter
from typing import List

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'query-pagination-example-py')

last_id = None
while True:
    filters: List[Filter] = [('timestamp', 'Gte', datetime(2024, 1, 1, 0, 0, 0))]

    if last_id is not None:
        filters.append(('id', 'Gt', last_id))

    result = ns.query(
        rank_by=('id', 'asc'),
        limit=1000,
        filters=('And', filters),
    )
    print(result)

    if len(result.rows) < 1000:
        break
    last_id = result.rows[-1].id
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { Filter } from "@turbopuffer/turbopuffer/resources";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`query-pagination-example-ts`);

let lastId: string | number | null = null;
while (true) {
  const filters: Filter[] = [
    ["timestamp", "Gte", new Date("2024-01-01").toISOString()],
  ];

  if (lastId !== null) filters.push(["id", "Gt", lastId]);

  const result = await ns.query({
    rank_by: ["id", "asc"],
    limit: 1000,
    filters: ["And", filters],
  });
  console.log(result.rows);

  if (result.rows!.length < 1000) break;
  lastId = result.rows![result.rows!.length - 1].id;
}
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-pagination-example-go")

	var lastID any
	for {
		filters := []turbopuffer.Filter{
			turbopuffer.NewFilterGte("timestamp", time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)),
		}

		if lastID != nil {
			filter := turbopuffer.NewFilterGt("id", lastID)
			filters = append(filters, filter)
		}

		result, err := ns.Query(
			ctx,
			turbopuffer.NamespaceQueryParams{
				RankBy:  turbopuffer.NewRankByAttribute("id", turbopuffer.RankByAttributeOrderAsc),
				Limit: turbopuffer.LimitParam{
					Total: 1000,
				},
				Filters: turbopuffer.NewFilterAnd(filters),
			},
		)
		if err != nil {
			panic(err)
		}
		fmt.Print(turbopuffer.PrettyPrint(result.Rows))

		if len(result.Rows) < 1000 {
			break
		}
		lastID = result.Rows[len(result.Rows)-1]["id"]
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.time.*;
import java.util.*;
import java.util.stream.*;

public class QueryPagination {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-pagination-example-java");

    JsonValue lastId = null;
    while (true) {
      Filter filters = Filter.gte(
        "timestamp",
        ZonedDateTime.of(2024, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC)
      );
      if (lastId != null) {
        filters = Filter.and(filters, Filter.gt("id", lastId));
      }
      var result = ns.query(
        NamespaceQueryParams.builder()
          .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
          .limit(1000)
          .filters(filters)
          .build()
      );
      var rows = result.rows().get();

      // Do something with the page of results.
      System.out.println(rows);

      if (rows.size() < 1000) {
        break;
      }
      lastId = rows.get(rows.size() - 1).get("id");
    }
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using System.Text.Json;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("query-pagination-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

JsonElement? lastId = null;
while (true)
{
    Filter filters = Filter.Gte("timestamp", new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc));
    if (lastId != null)
    {
        filters = Filter.And(filters, Filter.Gt("id", lastId));
    }
    var result = await ns.Query(
        new NamespaceQueryParams
        {
            RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
            Limit = 1000,
            Filters = filters,
        }
    );
    var rows = result.GetRows();

    // Do something with the page of results.
    foreach (var row in rows)
    {
        Console.WriteLine(row);
    }

    if (rows.Count < 1000)
    {
        break;
    }
    lastId = rows[^1]["id"];
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("query-pagination-example-rb")

last_id = nil
loop do
  filters = [["timestamp", "Gte", DateTime.new(2024, 1, 1, 0, 0, 0)]]

  if last_id
    filters << ["id", "Gt", last_id]
  end

  result = ns.query(
    rank_by: ["id", "asc"],
    limit: 1000,
    filters: ["And", filters],
  )
  puts result.rows

  break if result.rows.length < 1000
  last_id = result.rows.last.id
end
```
<!-- /multilang -->

## kNN (Exact Search)

Use `kNN` instead of `ANN` when you need exact nearest neighbor results rather than
approximate results. kNN performs an exhaustive search, computing the exact distance
from the query vector to every document matching the filters. Because kNN computes
distances to all matching documents, latency scales linearly with the number of
documents matching the filters and can be significantly higher than ANN queries.

**Requirements:**
- kNN queries **require filters** to be specified to bound the search space
- Without filters, use `ANN` which leverages the vector index for fast approximate search

**When to use kNN vs ANN:**
- Use `ANN` (default) for large-scale search where slight approximation is acceptable and speed matters
- Use `kNN` when you need guaranteed exact results over a filtered subset of your data

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/query-knn-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["vector", "kNN", [0.1, 0.1]],
   "filters": ["category", "Eq", "A"],
   "limit": 10
 }'

# Response payload
# {
#   "rows": [
#     { "$dist": 0.2, "id": 1 },
#     { "$dist": 0.7, "id": 2 }
#   ]
# }
```
```python
# $ pip install turbopuffer
import turbopuffer
import os

tpuf = turbopuffer.Turbopuffer(
    # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    api_key=os.getenv("TURBOPUFFER_API_KEY"),
    # Pick the right region: https://turbopuffer.com/docs/regions
    region="gcp-us-central1",
)

ns = tpuf.namespace(f'query-knn-example-py')

# kNN performs exact nearest neighbor search over filtered results
result = ns.query(
    rank_by=("vector", "kNN", [0.1, 0.1]),
    filters=("category", "Eq", "A"),
    limit=10,
)
print(result.rows)

# Prints a list of row-oriented documents:
# [
#   Row(id=1, vector=None, $dist=0.2),
#   Row(id=2, vector=None, $dist=0.7)
# ]
```
```typescript
// $ npm install @turbopuffer/turbopuffer
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`query-knn-example-ts`);

// kNN performs exact nearest neighbor search over filtered results
const result = await ns.query({
  rank_by: ["vector", "kNN", [0.1, 0.1]],
  filters: ["category", "Eq", "A"],
  limit: 10,
});
console.log(result.rows);
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
		// API tokens are created in the dashboard: https://turbopuffer.com/dashboard
		option.WithAPIKey(os.Getenv("TURBOPUFFER_API_KEY")),
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("query-knn-example-go")

	// kNN performs exact nearest neighbor search over filtered results
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy:  turbopuffer.NewRankByKnn("vector", []float32{0.1, 0.1}),
			Filters: turbopuffer.NewFilterEq("category", "A"),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))

	// Returns a row-oriented result:
	// [
	//   {"id": 1, "$dist": 0.2},
	//   {"id": 2, "$dist": 0.7}
	// ]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QueryKnn {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("query-knn-example-java");

    // kNN performs exact nearest neighbor search over filtered results
    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.knn("vector", List.of(0.1f, 0.1f)))
        .filters(Filter.eq("category", "A"))
        .limit(10)
        .build()
    );
    System.out.println(result.rows().get());
    // Prints a list of row-oriented documents:
    // [
    //   {id=1, $dist=0.2},
    //   {id=2, $dist=0.7}
    // ]
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
    // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    // Loaded from TURBOPUFFER_API_KEY env var by default. Override if necessary:
    // ApiKey = "...",

    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("query-knn-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// kNN performs exact nearest neighbor search over filtered results
var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Knn("vector", new[] { 0.1f, 0.1f }),
        Filters = Filter.Eq("category", "A"),
        Limit = 10,
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// Prints a list of row-oriented documents:
// {"$dist": 0.2, "id": 1}
// {"$dist": 0.7, "id": 2}
```
```ruby
# $ gem install turbopuffer
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  api_key: ENV["TURBOPUFFER_API_KEY"],
  # Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
)

ns = tpuf.namespace("query-knn-example-rb")

# kNN performs exact nearest neighbor search over filtered results
result = ns.query(
  rank_by: ["vector", "kNN", [0.1, 0.1]],
  filters: ["category", "Eq", "A"],
  limit: 10,
)
puts result.rows

# Prints a list of row-oriented documents:
# {id: 1, dist: 0.2}
# {id: 2, dist: 0.7}
```
<!-- /multilang -->
