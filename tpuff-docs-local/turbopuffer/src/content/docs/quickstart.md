---
title: "Quickstart Guide"
description: "Get a quick feel for the API with some examples. Python client TypeScript client Go client Java client C client Ruby client Community Rust client Samp"
group: "Guides"
---

Get a quick feel for the API with some examples.
* [Python client](https://github.com/turbopuffer/turbopuffer-python)
* [TypeScript client](https://github.com/turbopuffer/turbopuffer-typescript)
* [Go client](https://github.com/turbopuffer/turbopuffer-go)
* [Java client](https://github.com/turbopuffer/turbopuffer-java)
* [C# client](https://github.com/turbopuffer/turbopuffer-csharp)
* [Ruby client](https://github.com/turbopuffer/turbopuffer-ruby)
* [Community Rust client](https://crates.io/crates/turbopuffer-client)
* [Sample Python notebook](https://colab.research.google.com/drive/17i4sfFTeJQkINCxjBaOGOZeENZr4ZaTE)

<!-- multilang -->
```bash
# Upsert documents with vectors and attributes
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/quickstart-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "upsert_rows": [
     {
       "id": 1,
       "vector": [0.1, 0.2],
       "name": "foo",
       "public": 1,
       "text": "walrus narwhal"
     },
     {
       "id": 2,
       "vector": [0.3, 0.4],
       "name": "foo",
       "public": 0,
       "text": "elephant walrus rhino"
     }
   ],
   "schema": {
     "text": {
       "type": "string",
       "full_text_search": true
     }
   },
   "distance_metric": "cosine_distance"
 }'

# Query nearest neighbors with filter
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/quickstart-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["vector", "ANN", [0.1, 0.2]],
   "limit": 10,
   "filters": ["And", [["name", "Eq", "foo"], ["public", "Eq", 1]]],
   "include_attributes": ["name"]
 }'
# {
#   "rows": [{"$dist": 0.0, "id": 1, "attributes": {"name": "foo"}}]
# }

# Full-text search on an attribute
# To combine FTS and vector search concurrently and fuse results, see https://turbopuffer.com/docs/hybrid-search
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/quickstart-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "limit": 10,
   "filters": ["name", "Eq", "foo"],
   "rank_by": ["text", "BM25", "quick walrus"]
 }'
# {
#   "rows": [
#     {"$dist": 0.19, "id": 1, "attributes": {"name": "foo"}},
#     {"$dist": 0.168, "id": 2, "attributes": {"name": "foo"}}
#   ]
# }

# Vectors can be updated by passing new data for an existing ID
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/quickstart-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "upsert_rows": [
     {
       "id": 1,
       "vector": [1.1, 1.2],
       "name": "foo",
       "public": 1
     },
     {
       "id": 2,
       "vector": [1.3, 1.4],
       "name": "foo",
       "public": 1
     },
     {
       "id": 3,
       "vector": [1.5, 1.6],
       "name": "foo",
       "public": 1
     }
   ],
   "distance_metric": "cosine_distance"
 }'

# Vectors are deleted by passing the IDs
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/quickstart-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "deletes": [1, 3]
 }'
```
```python
# $ pip install turbopuffer
import turbopuffer
import os
from typing import List

tpuf = turbopuffer.Turbopuffer(
    # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    api_key=os.getenv("TURBOPUFFER_API_KEY"),
    # Pick the right region: https://turbopuffer.com/docs/regions
    region="gcp-us-central1",
)

ns = tpuf.namespace(f'quickstart-example-py')

# Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
# Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
def openai_or_rand_vector(text: str) -> List[float]:
    if not os.getenv("OPENAI_API_KEY"): print("OPENAI_API_KEY not set, using random vectors"); return [__import__('random').random() for _ in range(2)]
    try: return __import__('openai').embeddings.create(model="text-embedding-3-small",input=text).data[0].embedding
    except ImportError: print("openai package not installed, using random vectors (`pip install openai`)"); return [__import__('random').random() for _ in range(2)]

# Upsert documents with vectors and attributes
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'vector': openai_or_rand_vector("walrus narwhal"),
            'category': "mammal",
            'public': 1,
            'text': "walrus narwhal",
        },
        {
            'id': 2,
            'vector': openai_or_rand_vector("pufferfish clownfish swordfish"),
            'category': "fish",
            'public': 0,
            'text': "pufferfish clownfish swordfish",
        },
    ],
    distance_metric='cosine_distance',
    schema={
        "text": { # Configure FTS/BM25, other attribtues have inferred types (category: str, public: int)
            "type": "string",
             # More schema & FTS options https://turbopuffer.com/docs/write#schema
            "full_text_search": True,
        }
    }
)

# Query nearest neighbors with filter
print(ns.query(
  rank_by=("vector", "ANN", openai_or_rand_vector("arctic sea mammal")),
  limit=10,
  filters=("And", (("category", "Eq", "mammal"), ("public", "Eq", 1))),
  include_attributes=["category"],
))
# [Row(id=1, vector=None, $dist=0.42773545, category='mammal')]

# Full-text search on an attribute
# To combine FTS and vector search concurrently and fuse results, see https://turbopuffer.com/docs/hybrid-search
print(ns.query(
  limit=10,
  filters=("category", "Eq", "mammal"),
  rank_by=('text', 'BM25', 'quick walrus'),
))
# [Row(id=1, vector=None, $dist=0.7549128)]

# Vectors can be updated by passing new data for an existing ID
ns.write(
  upsert_rows=[
    {
      'id': 1,
      'vector': openai_or_rand_vector("foo"),
      'name': "foo",
      'public': 1,
    },
    {
      'id': 2,
      'vector': openai_or_rand_vector("foo"),
      'name': "foo",
      'public': 1,
    },
    {
      'id': 3,
      'vector': openai_or_rand_vector("foo"),
      'name': "foo",
      'public': 1,
    },
  ],
  distance_metric='cosine_distance',
)
# Vectors are deleted by ID.
ns.write(deletes=[1, 3])
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

const ns = tpuf.namespace(`quickstart-example-ts`);

// Upsert documents with vectors and attributes
await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: await openaiOrRandVector("walrus narwhal"),
      category: "mammal",
      public: 1,
      text: "walrus narwhal",
    },
    {
      id: 2,
      vector: await openaiOrRandVector("pufferfish clownfish swordfish"),
      category: "fish",
      public: 0,
      text: "pufferfish clownfish swordfish",
    },
  ],
  distance_metric: "cosine_distance",
  schema: {
    text: {
      // Configure FTS/BM25, other attributes have inferred types (category: str, public: int)
      type: "string",
      // More schema & FTS options https://turbopuffer.com/docs/write#schema
      full_text_search: true,
    },
  },
});

// Query nearest neighbors with filter
let result = await ns.query({
  rank_by: ["vector", "ANN", await openaiOrRandVector("arctic sea mammal")],
  limit: 10,
  filters: [
    "And",
    [
      ["category", "Eq", "mammal"],
      ["public", "Eq", 1],
    ],
  ],
  include_attributes: ["category"],
});
console.log(result.rows);
// [{ '$dist': 0.42773545, id: 1, category: 'mammal' }]

// Full-text search on an attribute
// To combine FTS and vector search concurrently and fuse results, see https://turbopuffer.com/docs/hybrid-search
result = await ns.query({
  limit: 10,
  filters: ["category", "Eq", "mammal"],
  rank_by: ["text", "BM25", "quick walrus"],
});
console.log(result.rows);
// [{ '$dist': 0.7549128, id: 1 }]

// Vectors can be updated by passing new data for an existing ID
await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: await openaiOrRandVector("foo"),
      name: "foo",
      public: 1,
    },
    {
      id: 2,
      vector: await openaiOrRandVector("foo"),
      name: "foo",
      public: 1,
    },
    {
      id: 3,
      vector: await openaiOrRandVector("foo"),
      name: "foo",
      public: 1,
    },
  ],
  distance_metric: "cosine_distance",
});

// Vectors are deleted by ID.
await ns.write({
  deletes: [1, 3],
});

// Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
// Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
async function openaiOrRandVector(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set, using random vectors");
    return [Math.random(), Math.random()];
  }
  try {
    const { OpenAI } = await import("openai");
    return (
      await new OpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      })
    ).data[0].embedding;
  } catch {
    console.log(
      "OpenAI package not installed, using random vectors (`npm install openai`)",
    );
    return [Math.random(), Math.random()];
  }
}
```
```go
package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"

	"github.com/openai/openai-go"
	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

// Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
// Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
func openaiOrRandVector(ctx context.Context, text string) []float32 {
	if os.Getenv("OPENAI_API_KEY") == "" {
		fmt.Println("OPENAI_API_KEY not set, using random vectors")
		return []float32{rand.Float32(), rand.Float32()}
	}

	client := openai.NewClient()
	resp, err := client.Embeddings.New(ctx, openai.EmbeddingNewParams{
		Input: openai.EmbeddingNewParamsInputUnion{OfString: openai.String(text)},
		Model: openai.EmbeddingModelTextEmbedding3Small,
	})
	if err != nil {
		fmt.Printf("OpenAI error, using random vectors: %v\n", err)
		return []float32{rand.Float32(), rand.Float32()}
	}
	embedding := make([]float32, len(resp.Data[0].Embedding))
	for i, v := range resp.Data[0].Embedding {
		embedding[i] = float32(v)
	}
	return embedding
}

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// API tokens are created in the dashboard: https://turbopuffer.com/dashboard
		option.WithAPIKey(os.Getenv("TURBOPUFFER_API_KEY")),
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	ns := tpuf.Namespace("quickstart-example-go")

	// Upsert documents with vectors and attributes
	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":     1,
					"vector": openaiOrRandVector(ctx, "walrus narwhal"),
					"category": "mammal",
					"public": 1,
					"text":   "walrus narwhal",
				},
				{
					"id":     2,
					"vector": openaiOrRandVector(ctx, "pufferfish clownfish swordfish"),
					"category": "fish",
					"public": 0,
					"text":   "pufferfish clownfish swordfish",
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				// Configure FTS/BM25, other attributes have inferred types (category: str, public: int)
				"text": {
					Type:           "string",
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}

	// Query nearest neighbors with filter
	res, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByAnn("vector", openaiOrRandVector(ctx, "arctic sea mammal")),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				turbopuffer.NewFilterEq("category", "mammal"),
				turbopuffer.NewFilterEq("public", 1),
			}),
			IncludeAttributes: turbopuffer.IncludeAttributesParam{StringArray: []string{"category"}},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(res.Rows))
	// [{"id": 1, "vector": null, "$dist": 0.42773545, "category": "mammal"}]

	// Full-text search on an attribute
	// To combine FTS and vector search concurrently and fuse results, see https://turbopuffer.com/docs/hybrid-search
	res, err = ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			Filters: turbopuffer.NewFilterEq("category", "mammal"),
			RankBy:  turbopuffer.NewRankByTextBM25("text", "quick walrus"),
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(res.Rows))
	// [{"id": 1, "vector": null, "$dist": 0.7549128}]
	// Vectors can be updated by passing new data for an existing ID
	ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":     1,
					"vector": openaiOrRandVector(ctx, "foo"),
					"name":   "foo",
					"public": 1,
				},
				{
					"id":     2,
					"vector": openaiOrRandVector(ctx, "foo"),
					"name":   "foo",
					"public": 1,
				},
				{
					"id":     3,
					"vector": openaiOrRandVector(ctx, "foo"),
					"name":   "foo",
					"public": 1,
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)

	// Vectors are deleted by ID.
	_, err = ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			Deletes: []any{1, 3},
		},
	)
	if err != nil {
		panic(err)
	}
}
```
```java
// dependencies {
//     implementation("com.turbopuffer:turbopuffer-java:+")
//     implementation("com.openai:openai-java:+")
// }

package com.turbopuffer.docs;

import com.openai.client.okhttp.*;
import com.openai.errors.*;
import com.openai.models.embeddings.*;
import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class QuickStart {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("quickstart-example-java");

    // Upsert documents with vectors and attributes
    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("vector", openAiOrRandVector("walrus narwhal"))
            .put("category", "mammal")
            .put("public", 1)
            .put("text", "walrus narwhal")
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("vector", openAiOrRandVector("pufferfish clownfish swordfish"))
            .put("category", "fish")
            .put("public", 0)
            .put("text", "pufferfish clownfish swordfish")
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .schema(
          Schema.builder()
            .put(
              "text",
              AttributeSchemaConfig.builder()
                .type("string")
                // More schema & FTS options
                // https://turbopuffer.com/docs/write#schema
                .fullTextSearch(FullTextSearchConfig.defaults())
                .build()
            )
            .build()
        )
        .build()
    );

    // Query nearest neighbors with filter
    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.ann("vector", openAiOrRandVector("arctic sea mammal")))
        .limit(10)
        .filters(Filter.and(Filter.eq("category", "mammal"), Filter.eq("public", 1)))
        .includeAttributes("category")
        .build()
    );
    System.out.println(queryResult);
    // NamespaceQueryResponse{rows=[{$dist=0.42773545, id=1, category=mammal}]}

    // Full-text search on an attribute
    // To combine FTS and vector search concurrently and fuse results, see https://turbopuffer.com/docs/hybrid-search
    var ftsResult = ns.query(
      NamespaceQueryParams.builder()
        .limit(10)
        .filters(Filter.eq("category", "mammal"))
        .rankBy(RankByText.bm25("text", "quick walrus"))
        .build()
    );
    System.out.println(ftsResult);
    // NamespaceQueryResponse{rows=[{$dist=0.7549128, id=1}]}
    // Vectors can be updated by passing new data for an existing ID
    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("vector", openAiOrRandVector("foo"))
            .put("name", "foo")
            .put("public", 1)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("vector", openAiOrRandVector("foo"))
            .put("name", "foo")
            .put("public", 1)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 3)
            .put("vector", openAiOrRandVector("foo"))
            .put("name", "foo")
            .put("public", 1)
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );

    // Vectors are deleted by ID.
    ns.write(NamespaceWriteParams.builder().addDelete(1).addDelete(3).build());
  }

  // Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
  // Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
  public static List<Float> openAiOrRandVector(String text) {
    if (System.getenv("OPENAI_API_KEY") == null) {
      System.out.println("OPENAI_API_KEY not set, using random vectors");
      return randVector();
    }
    var client = OpenAIOkHttpClient.fromEnv();
    try {
      var params = EmbeddingCreateParams.builder()
        .input(text)
        .model(EmbeddingModel.TEXT_EMBEDDING_3_SMALL)
        .build();
      var response = client.embeddings().create(params);
      return response.data().get(0).embedding();
    } catch (OpenAIException e) {
      System.out.println("OpenAI error, using random vectors: " + e.getMessage());
      return randVector();
    }
  }

  public static List<Float> randVector() {
    Random rand = new Random();
    List<Float> vector = new java.util.ArrayList<>(2);
    vector.add(rand.nextFloat());
    vector.add(rand.nextFloat());
    return vector;
  }
}
```
```cs
// dotnet add package Turbopuffer
// dotnet add package OpenAI
using System;
using System.Collections.Generic;
using System.Linq;
using OpenAI.Embeddings;
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

var ns = tpuf.Namespace("quickstart-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// Upsert documents with vectors and attributes
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("vector", OpenAiOrRandVector("walrus narwhal"))
                .Set("category", "mammal")
                .Set("public", 1)
                .Set("text", "walrus narwhal"),
            new Row()
                .Set("id", 2)
                .Set("vector", OpenAiOrRandVector("pufferfish clownfish swordfish"))
                .Set("category", "fish")
                .Set("public", 0)
                .Set("text", "pufferfish clownfish swordfish"),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["text"] = new AttributeSchemaConfig
            {
                Type = "string",
                // More schema & FTS options
                // https://turbopuffer.com/docs/write#schema
                FullTextSearch = true,
            },
        },
    }
);

// Query nearest neighbors with filter
var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Ann("vector", OpenAiOrRandVector("arctic sea mammal")),
        Limit = 10,
        Filters = Filter.And(Filter.Eq("category", "mammal"), Filter.Eq("public", 1)),
        IncludeAttributes = new List<string> { "category" },
    }
);
foreach (var row in queryResult.GetRows())
{
    Console.WriteLine(row);
}
// {"$dist": 0.42773545, "id": 1, "category": "mammal"}

// Full-text search on an attribute
// To combine FTS and vector search concurrently and fuse results, see https://turbopuffer.com/docs/hybrid-search
var ftsResult = await ns.Query(
    new NamespaceQueryParams
    {
        Limit = 10,
        Filters = Filter.Eq("category", "mammal"),
        RankBy = RankByText.BM25("text", "quick walrus"),
    }
);
foreach (var row in ftsResult.GetRows())
{
    Console.WriteLine(row);
}
// {"$dist": 0.7549128, "id": 1}

// Vectors can be updated by passing new data for an existing ID
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row().Set("id", 1).Set("vector", OpenAiOrRandVector("foo")).Set("name", "foo").Set("public", 1),
            new Row().Set("id", 2).Set("vector", OpenAiOrRandVector("foo")).Set("name", "foo").Set("public", 1),
            new Row().Set("id", 3).Set("vector", OpenAiOrRandVector("foo")).Set("name", "foo").Set("public", 1),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);

// Vectors are deleted by ID.
await ns.Write(new NamespaceWriteParams { Deletes = [1L, 3L] });

// Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
// Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
static List<float> OpenAiOrRandVector(string text)
{
    if (Environment.GetEnvironmentVariable("OPENAI_API_KEY") == null)
    {
        Console.WriteLine("OPENAI_API_KEY not set, using random vectors");
        return RandVector();
    }
    try
    {
        var client = new EmbeddingClient(
            "text-embedding-3-small",
            Environment.GetEnvironmentVariable("OPENAI_API_KEY")
        );
        return [.. client.GenerateEmbedding(text).Value.ToFloats().Span];
    }
    catch (Exception e)
    {
        Console.WriteLine($"OpenAI error, using random vectors: {e.Message}");
        return RandVector();
    }
}

static List<float> RandVector()
{
    return new List<float> { (float)Random.Shared.NextDouble(), (float)Random.Shared.NextDouble() };
}
```
```ruby
# $ gem install turbopuffer
require "turbopuffer"
require "json"

tpuf = Turbopuffer::Client.new(
  # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  api_key: ENV["TURBOPUFFER_API_KEY"],
  # Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
)

ns = tpuf.namespace("quickstart-example-rb")

# Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
# Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
def openai_or_rand_vector(text)
  if ENV["OPENAI_API_KEY"].nil? || ENV["OPENAI_API_KEY"].empty?
    puts "Warning: OPENAI_API_KEY not set, using random vectors"
    return [rand, rand]
  end

  begin
    require "openai"
    OpenAI::Client.new().embeddings.create(model: "text-embedding-3-small", input: text).data[0].embedding
  rescue LoadError
    puts "Warning: openai gem not installed (`gem install openai`), using random vectors"
    [rand, rand]
  end
end

# Upsert documents with vectors and attributes
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: openai_or_rand_vector("walrus narwhal"),
      category: "mammal",
      public: 1,
      text: "walrus narwhal",
    },
    {
      id: 2,
      vector: openai_or_rand_vector("pufferfish clownfish swordfish"),
      category: "fish",
      public: 0,
      text: "pufferfish clownfish swordfish",
    },
  ],
  distance_metric: "cosine_distance",
  schema: {
    text: { # Configure FTS/BM25, other attributes have inferred types (category: str, public: int)
      type: "string",
      # More schema & FTS options https://turbopuffer.com/docs/write#schema
      full_text_search: true,
    },
  },
)

# Query nearest neighbors with filter
result = ns.query(
  rank_by: ["vector", "ANN", openai_or_rand_vector("arctic sea mammal")],
  limit: 10,
  filters: ["And", [["category", "Eq", "mammal"], ["public", "Eq", 1]]],
  include_attributes: ["category"],
)
puts result.rows
# {id: 1, "$dist": 0.42773545, category: "mammal"}

# Full-text search on an attribute
# If you want to combine FTS and vector search, see https://turbopuffer.com/docs/hybrid-search
result = ns.query(
  limit: 10,
  filters: ["category", "Eq", "mammal"],
  rank_by: ["text", "BM25", "quick walrus"],
)
puts result.rows
# {id: 1, "$dist": 0.7549128}

# Vectors can be updated by passing new data for an existing ID
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: openai_or_rand_vector("foo"),
      name: "foo",
      public: 1,
    },
    {
      id: 2,
      vector: openai_or_rand_vector("foo"),
      name: "foo",
      public: 1,
    },
    {
      id: 3,
      vector: openai_or_rand_vector("foo"),
      name: "foo",
      public: 1,
    },
  ],
  distance_metric: "cosine_distance",
)
# Vectors are deleted by ID.
ns.write(deletes: [1, 3])
```
<!-- /multilang -->
