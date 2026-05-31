---
title: "Permissions"
description: "When a namespace contains documents belonging to multiple users or groups, queries should only return documents the user has access to."
group: "Guides"
---

When a namespace contains documents belonging to multiple users or groups, queries should only return documents the user has access to.

Permissions in turbopuffer currently have to be implemented at the user-level with filters, as turbopuffer doesn't provide built-in mechanisms for row/document-level RBAC.

## Recommended approach

Store the `user_id` or `group_ids` that have read access directly on each document. At query time, fetch the user's id and groups from your auth layer and pass them as a filter.
Generally this approach is more performant than passing document ids in a filter.

An array can be up to 8Mib in size so any group and user id identifiers stored on each document have to fit into this [limit](/docs/limits). 
We store [filterable attributes in an inverted index structure](/docs/query#filtering) that allows us to efficiently filter 10 000s of user ids without performance degradation. 

To reduce storage costs associated with storing user and group permissions on each document, encode them as uuids. 
Note that the uuid type needs to be explicitly specified in the schema, otherwise the type will be inferred as a slower and more expensive string type. 

<!-- multilang -->
```bash
# write a few sample documents that are permissioned by group and user_ids
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/permissions-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "upsert_rows": [
      {
        "id": 1,
        "vector": [1, 1],
        "content": "changes in the leadership team",
        "groups": [],
        "user_ids": [123, 453, 125, 189]
      },
      {
        "id": 2,
        "vector": [2, 1],
        "content": "simon & nikhil - 1:1 notes",
        "groups": [],
        "user_ids": [123, 125]
      },
      {
        "id": 3,
        "vector": [6, 1],
        "content": "notes on planned Kubernetes migration",
        "groups": ["eng"],
        "user_ids": [96]
      }
    ],
    "schema": {
      "content": {
        "type": "string",
        "full_text_search": true
      }
    },
    "distance_metric": "cosine_distance"
  }'

# now we can query the data passing in the appropriate permissions
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/permissions-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rank_by": ["content", "BM25", "notes"],
    "filters": ["Or", [
      ["groups", "Contains", "design"],
      ["user_ids", "Contains", 96]
    ]],
    "limit": 10,
    "include_attributes": ["content"]
  }'

# {"rows": [{"id": 3, "$dist": 0.9686553, "content": "notes on planned Kubernetes migration"}]}
```
```python
import os
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
    api_key=os.getenv('TURBOPUFFER_API_KEY'),
)

ns = tpuf.namespace(f'permissions-example-py')

# write a few sample documents that are permissioned by group and user_ids

ns.write(
    upsert_rows=[
        {
            'id': 1,
            'vector': [1, 1],
            'content': 'changes in the leadership team',
            'groups': [],
            'user_ids' : [123, 453, 125, 189]
        },
        {
            'id': 2,
            'vector': [2, 1],
            'content': 'simon & nikhil - 1:1 notes',
            'groups': [],
            'user_ids' : [123, 125]
        },
        {
            'id': 3,
            'vector': [6, 1],
            'content': 'notes on planned Kubernetes migration',
            'groups': ['eng'],
            'user_ids' : [96]
        }
    ],
    schema={
        'content': {
            'type': 'string',
            'full_text_search': True
        }
    },
    distance_metric='cosine_distance'
)

# now we can query the data passing in the appropriate permissions

result = ns.query(
    rank_by=('content', 'BM25', 'notes'),
    filters=('Or', (
        ('groups', 'Contains', 'design'),
        ('user_ids', 'Contains', 96))),
    limit=10,
    include_attributes=['content']
)
print(result.rows)

# [Row(id=3, vector=None, $dist=0.9686553, content='notes on planned Kubernetes migration')]
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`permissions-example-ts`);

// write a few sample documents that are permissioned by group and user_ids
await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: [1, 1],
      content: "changes in the leadership team",
      groups: [],
      user_ids: [123, 453, 125, 189],
    },
    {
      id: 2,
      vector: [2, 1],
      content: "simon & nikhil - 1:1 notes",
      groups: [],
      user_ids: [123, 125],
    },
    {
      id: 3,
      vector: [6, 1],
      content: "notes on planned Kubernetes migration",
      groups: ["eng"],
      user_ids: [96],
    },
  ],
  schema: {
    content: {
      type: "string",
      full_text_search: true,
    },
  },
  distance_metric: "cosine_distance",
});

// now we can query the data passing in the appropriate permissions
const result = await ns.query({
  rank_by: ["content", "BM25", "notes"],
  filters: [
    "Or",
    [
      ["groups", "Contains", "design"],
      ["user_ids", "Contains", 96],
    ],
  ],
  limit: 10,
  include_attributes: ["content"],
});

console.log(result.rows);
// [{ id: 3, dist: 0.9686553, attributes: { content: 'notes on planned Kubernetes migration' } }]
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
	// pick the right region: https://turbopuffer.com/docs/regions
	client := turbopuffer.NewClient(option.WithRegion("gcp-us-central1"))

	ns := client.Namespace("permissions-example-go")

	// write a few sample documents that are permissioned by group and user_ids
	_, err := ns.Write(ctx, turbopuffer.NamespaceWriteParams{
		UpsertRows: []turbopuffer.RowParam{
			{
				"id":       1,
				"vector":   []float32{1, 1},
				"content":  "changes in the leadership team",
				"groups":   []string{},
				"user_ids": []int{123, 453, 125, 189},
			},
			{
				"id":       2,
				"vector":   []float32{2, 1},
				"content":  "simon & nikhil - 1:1 notes",
				"groups":   []string{},
				"user_ids": []int{123, 125},
			},
			{
				"id":       3,
				"vector":   []float32{6, 1},
				"content":  "notes on planned Kubernetes migration",
				"groups":   []string{"eng"},
				"user_ids": []int{96},
			},
		},
		Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
			"content": {
				Type:           turbopuffer.AttributeType("string"),
				FullTextSearch: &turbopuffer.FullTextSearchConfigParam{},
			},
		},
		DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
	})
	if err != nil {
		panic(err)
	}

	// now we can query the data passing in the appropriate permissions
	result, err := ns.Query(ctx, turbopuffer.NamespaceQueryParams{
		RankBy: turbopuffer.NewRankByTextBM25("content", "notes"),
		Limit: turbopuffer.LimitParam{
			Total: 10,
		},
		IncludeAttributes: turbopuffer.IncludeAttributesParam{StringArray: []string{"content"}},
		Filters: turbopuffer.NewFilterOr([]turbopuffer.Filter{
			turbopuffer.NewFilterContains("groups", "design"),
			turbopuffer.NewFilterContains("user_ids", 96),
		}),
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(result.Rows)
	// [map[id:3 $dist:0.9686553 content:notes on planned Kubernetes migration]]
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.TurbopufferOkHttpClient;
import com.turbopuffer.models.namespaces.AttributeSchemaConfig;
import com.turbopuffer.models.namespaces.DistanceMetric;
import com.turbopuffer.models.namespaces.Filter;
import com.turbopuffer.models.namespaces.NamespaceQueryParams;
import com.turbopuffer.models.namespaces.NamespaceWriteParams;
import com.turbopuffer.models.namespaces.RankByText;
import com.turbopuffer.models.namespaces.Row;
import com.turbopuffer.models.namespaces.Schema;
import java.util.Arrays;
import java.util.List;

public class Permissions {

  public static void main(String[] args) {
    var client = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = client.namespace("permissions-example-java");

    // write a few sample documents that are permissioned by group and user_ids
    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("vector", Arrays.asList(1.0, 1.0))
            .put("content", "changes in the leadership team")
            .put("groups", List.of())
            .put("user_ids", Arrays.asList(123, 453, 125, 189))
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("vector", Arrays.asList(2.0, 1.0))
            .put("content", "simon & nikhil - 1:1 notes")
            .put("groups", List.of())
            .put("user_ids", Arrays.asList(123, 125))
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 3)
            .put("vector", Arrays.asList(6.0, 1.0))
            .put("content", "notes on planned Kubernetes migration")
            .put("groups", List.of("eng"))
            .put("user_ids", List.of(96))
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .schema(
          Schema.builder()
            .put(
              "content",
              AttributeSchemaConfig.builder().type("string").fullTextSearch(true).build()
            )
            .build()
        )
        .build()
    );

    // now we can query the data passing in the appropriate permissions
    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", "notes"))
        .filters(Filter.or(Filter.contains("groups", "design"), Filter.contains("user_ids", 96)))
        .limit(10)
        .includeAttributes(List.of("content"))
        .build()
    );

    System.out.println(result.rows());
    // [Row{id=3, $dist=0.9686553, content=notes on planned Kubernetes migration}]
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
    // pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("permissions-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// write a few sample documents that are permissioned by group and user_ids
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("vector", new[] { 1.0f, 1.0f })
                .Set("content", "changes in the leadership team")
                .Set("groups", Array.Empty<string>())
                .Set("user_ids", new[] { 123, 453, 125, 189 }),
            new Row()
                .Set("id", 2)
                .Set("vector", new[] { 2.0f, 1.0f })
                .Set("content", "simon & nikhil - 1:1 notes")
                .Set("groups", Array.Empty<string>())
                .Set("user_ids", new[] { 123, 125 }),
            new Row()
                .Set("id", 3)
                .Set("vector", new[] { 6.0f, 1.0f })
                .Set("content", "notes on planned Kubernetes migration")
                .Set("groups", new[] { "eng" })
                .Set("user_ids", new[] { 96 }),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["content"] = new AttributeSchemaConfig
            {
                Type = "string",
                FullTextSearch = true,
            },
        },
    }
);

// now we can query the data passing in the appropriate permissions
var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", "notes"),
        Filters = Filter.Or(
            Filter.Contains("groups", "design"),
            Filter.Contains("user_ids", 96)
        ),
        Limit = 10,
        IncludeAttributes = new List<string> { "content" },
    }
);

foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// {"$dist": 0.9686553, "id": 3, "content": "notes on planned Kubernetes migration"}
```
```ruby
require "turbopuffer"

# pick the right region: https://turbopuffer.com/docs/regions
client = Turbopuffer::Client.new(region: "gcp-us-central1")

ns = client.namespace("permissions-example-rb")

# write a few sample documents that are permissioned by group and user_ids
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: [1, 1],
      content: "changes in the leadership team",
      groups: [],
      user_ids: [123, 453, 125, 189],
    },
    {
      id: 2,
      vector: [2, 1],
      content: "simon & nikhil - 1:1 notes",
      groups: [],
      user_ids: [123, 125],
    },
    {
      id: 3,
      vector: [6, 1],
      content: "notes on planned Kubernetes migration",
      groups: ["eng"],
      user_ids: [96],
    },
  ],
  schema: {
    content: {
      type: "string",
      full_text_search: true,
    },
  },
  distance_metric: Turbopuffer::DistanceMetric::COSINE_DISTANCE,
)

# now we can query the data passing in the appropriate permissions
result = ns.query(
  rank_by: ["content", "BM25", "notes"],
  filters: ["Or", [
    ["groups", "Contains", "design"],
    ["user_ids", "Contains", 96],
  ]],
  limit: 10,
  include_attributes: ["content"],
)

puts result.rows
# [{id: 3, $dist: 0.9686553, content: "notes on planned Kubernetes migration"}]
```
<!-- /multilang -->
