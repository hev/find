---
title: "Vector Search Guide"
description: "turbopuffer supports vector search with filtering. Vectors are incrementally indexed in an SPFresh vector index for performant search. Writes appear i"
group: "Guides"
---

turbopuffer supports vector search with [filtering](/docs/query#filtering).
Vectors are incrementally indexed in an SPFresh vector index for performant search.
Writes appear in search results immediately.

The vector index is automatically tuned for 90-100% recall ("accuracy"). We
automatically [monitor recall](/blog/continuous-recall) for production queries.
You can use the [recall endpoint](/docs/recall) to test yourself.

<!-- multilang -->
```bash
# Basic vector search example
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/vector-1-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "upsert_rows": [
     {"id": 1, "vector": [0.1, 0.2], "text": "A cat sleeping on a windowsill", "category": "animal"},
     {"id": 2, "vector": [0.15, 0.25], "text": "A playful kitten chasing a toy", "category": "animal"},
     {"id": 3, "vector": [0.8, 0.9], "text": "An airplane flying through clouds", "category": "vehicle"}
   ],
   "distance_metric": "cosine_distance"
 }'

curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/vector-1-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["vector", "ANN", [0.12, 0.22]],
   "limit": 2,
   "include_attributes": ["text"]
 }'
# Returns cat and kitten documents, sorted by vector similarity

# Example of vector search with filters
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/vector-2-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "upsert_rows": [
     {"id": 1, "vector": [0.1, 0.2], "description": "A shiny red sports car", "color": "red", "type": "car", "price": 50000},
     {"id": 2, "vector": [0.15, 0.25], "description": "A sleek blue sedan", "color": "blue", "type": "car", "price": 35000},
     {"id": 3, "vector": [0.3, 0.4], "description": "A large red delivery truck", "color": "red", "type": "truck", "price": 80000},
     {"id": 4, "vector": [0.35, 0.45], "description": "A blue pickup truck", "color": "blue", "type": "truck", "price": 45000}
   ],
   "distance_metric": "cosine_distance"
 }'

curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/vector-2-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["vector", "ANN", [0.12, 0.22]],
   "limit": 10,
   "filters": ["And", [
     ["price", "Lt", 60000],
     ["color", "Eq", "blue"]
   ]],
   "include_attributes": ["description", "price"]
 }'
# car, then truck
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

# Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
# Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
def openai_or_rand_vector(text: str) -> List[float]:
    if not os.getenv("OPENAI_API_KEY"): print("OPENAI_API_KEY not set, using random vectors"); return [__import__('random').random() for _ in range(2)]
    try: return __import__('openai').embeddings.create(model="text-embedding-3-small",input=text).data[0].embedding
    except ImportError: print("openai package not installed, using random vectors (`pip install openai`)"); return [__import__('random').random() for _ in range(2)]

ns = tpuf.namespace(f'vector-1-example-py')

# Basic vector search example
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'vector': openai_or_rand_vector("A cat sleeping on a windowsill"),
            'text': 'A cat sleeping on a windowsill',
            'category': 'animal',
        },
        {
            'id': 2,
            'vector': openai_or_rand_vector("A playful kitten chasing a toy"),
            'text': 'A playful kitten chasing a toy',
            'category': 'animal',
        },
        {
            'id': 3,
            'vector': openai_or_rand_vector("An airplane flying through clouds"),
            'text': 'An airplane flying through clouds',
            'category': 'vehicle',
        },
    ],
    distance_metric='cosine_distance'
)

result = ns.query(
    rank_by=("vector", "ANN", openai_or_rand_vector("feline")),
    limit=2,
    include_attributes=['text']
)
# Returns cat and kitten documents, sorted by vector similarity
print(result.rows)

# Example of vector search with filters
ns = tpuf.namespace(f'vector-2-example-py')
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'vector': openai_or_rand_vector("A shiny red sports car"),
            'description': 'A shiny red sports car',
            'color': 'red',
            'type': 'car',
            'price': 50000,
        },
        {
            'id': 2,
            'vector': openai_or_rand_vector("A sleek blue sedan"),
            'description': 'A sleek blue sedan',
            'color': 'blue',
            'type': 'car',
            'price': 35000,
        },
        {
            'id': 3,
            'vector': openai_or_rand_vector("A large red delivery truck"),
            'description': 'A large red delivery truck',
            'color': 'red',
            'type': 'truck',
            'price': 80000,
        },
        {
            'id': 4,
            'vector': openai_or_rand_vector("A blue pickup truck"),
            'description': 'A blue pickup truck',
            'color': 'blue',
            'type': 'truck',
            'price': 45000,
        },
    ],
    distance_metric='cosine_distance'
)

result = ns.query(
    rank_by=("vector", "ANN", openai_or_rand_vector("car")),  # Embedding similar to "car"
    limit=10,
    # Complex filter combining multiple conditions, see https://turbopuffer.com/docs/query for all options
    filters=('And', (
        ('price', 'Lt', 60000),
        ('color', 'Eq', 'blue')
    )),
    include_attributes=['description', 'price']
)
print(result.rows) # car, then truck
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

const ns = tpuf.namespace(`vector-1-example-ts`);
await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: await openaiOrRandVector("A cat sleeping on a windowsill"),
      text: "A cat sleeping on a windowsill",
      category: "animal",
    },
    {
      id: 2,
      vector: await openaiOrRandVector("A playful kitten chasing a toy"),
      text: "A playful kitten chasing a toy",
      category: "animal",
    },
    {
      id: 3,
      vector: await openaiOrRandVector("An airplane flying through clouds"),
      text: "An airplane flying through clouds",
      category: "vehicle",
    },
  ],
  distance_metric: "cosine_distance",
});

// Basic vector search
let result = await ns.query({
  rank_by: ["vector", "ANN", await openaiOrRandVector("feline")],
  limit: 2,
  include_attributes: ["text"],
});
// Returns cat and kitten documents, sorted by vector similarity
console.log(result.rows);

const ns2 = tpuf.namespace(`vector-2-example-ts`);
// Advanced Example
await ns2.write({
  upsert_rows: [
    {
      id: 1,
      vector: await openaiOrRandVector("A shiny red sports car"),
      description: "A shiny red sports car",
      color: "red",
      type: "car",
      price: 50000,
    },
    {
      id: 2,
      vector: await openaiOrRandVector("A sleek blue sedan"),
      description: "A sleek blue sedan",
      color: "blue",
      type: "car",
      price: 35000,
    },
    {
      id: 3,
      vector: await openaiOrRandVector("A large red delivery truck"),
      description: "A large red delivery truck",
      color: "red",
      type: "truck",
      price: 80000,
    },
    {
      id: 4,
      vector: await openaiOrRandVector("A blue pickup truck"),
      description: "A blue pickup truck",
      color: "blue",
      type: "truck",
      price: 45000,
    },
  ],
  distance_metric: "cosine_distance",
});

// Advanced vector search with filters
result = await ns2.query({
  rank_by: ["vector", "ANN", await openaiOrRandVector("car")], // Embedding similar to "car"
  limit: 10,
  // Complex filter combining multiple conditions
  filters: [
    "And",
    [
      ["color", "Eq", "blue"],
      ["price", "Lt", 40000],
      ["type", "Eq", "car"],
    ],
  ],
  include_attributes: ["description", "price"],
});
// Returns only blue cars under $40k, sorted by similarity to the query vector
console.log(result.rows);

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

	ns := tpuf.Namespace("vector-1-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":       1,
					"vector":   openaiOrRandVector(ctx, "A cat sleeping on a windowsill"),
					"text":     "A cat sleeping on a windowsill",
					"category": "animal",
				},
				{
					"id":       2,
					"vector":   openaiOrRandVector(ctx, "A playful kitten chasing a toy"),
					"text":     "A playful kitten chasing a toy",
					"category": "animal",
				},
				{
					"id":       3,
					"vector":   openaiOrRandVector(ctx, "An airplane flying through clouds"),
					"text":     "An airplane flying through clouds",
					"category": "vehicle",
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}

	// Basic vector search
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByAnn("vector", openaiOrRandVector(ctx, "feline")),
			Limit: turbopuffer.LimitParam{
				Total: 2,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{StringArray: []string{"text"}},
		},
	)
	if err != nil {
		panic(err)
	}
	// Returns cat and kitten documents, sorted by vector similarity
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))

	// Example of vector search with filters
	ns2 := tpuf.Namespace("vector-2-example-go")
	_, err = ns2.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":          1,
					"vector":      openaiOrRandVector(ctx, "A shiny red sports car"),
					"description": "A shiny red sports car",
					"color":       "red",
					"type":        "car",
					"price":       50000,
				},
				{
					"id":          2,
					"vector":      openaiOrRandVector(ctx, "A sleek blue sedan"),
					"description": "A sleek blue sedan",
					"color":       "blue",
					"type":        "car",
					"price":       35000,
				},
				{
					"id":          3,
					"vector":      openaiOrRandVector(ctx, "A large red delivery truck"),
					"description": "A large red delivery truck",
					"color":       "red",
					"type":        "truck",
					"price":       80000,
				},
				{
					"id":          4,
					"vector":      openaiOrRandVector(ctx, "A blue pickup truck"),
					"description": "A blue pickup truck",
					"color":       "blue",
					"type":        "truck",
					"price":       45000,
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		},
	)
	if err != nil {
		panic(err)
	}

	result, err = ns2.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByAnn("vector", openaiOrRandVector(ctx, "car")), // Embedding similar to "car"
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			// Complex filter combining multiple conditions, see https://turbopuffer.com/docs/query for all options
			Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				turbopuffer.NewFilterEq("color", "blue"),
				turbopuffer.NewFilterLt("price", 40000),
				turbopuffer.NewFilterEq("type", "car"),
			}),
			IncludeAttributes: turbopuffer.IncludeAttributesParam{StringArray: []string{"description", "price"}},
		},
	)
	if err != nil {
		panic(err)
	}
	// Returns only blue cars under $40k, sorted by similarity to the query vector
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))
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

public class Vector {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("vector-1-example-java");

    // Basic vector search example
    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("vector", openAiOrRandVector("A cat sleeping on a windowsill"))
            .put("text", "A cat sleeping on a windowsill")
            .put("category", "animal")
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("vector", openAiOrRandVector("A playful kitten chasing a toy"))
            .put("text", "A playful kitten chasing a toy")
            .put("category", "animal")
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 3)
            .put("vector", openAiOrRandVector("An airplane flying through clouds"))
            .put("text", "An airplane flying through clouds")
            .put("category", "vehicle")
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.ann("vector", openAiOrRandVector("feline")))
        .limit(2)
        .includeAttributes("text")
        .build()
    );
    // Returns cat and kitten documents, sorted by vector similarity
    System.out.println(result.rows().get());

    // Example of vector search with filters
    var ns2 = tpuf.namespace("vector-2-example-java");
    ns2.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("vector", openAiOrRandVector("A shiny red sports car"))
            .put("description", "A shiny red sports car")
            .put("color", "red")
            .put("type", "car")
            .put("price", 50000)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("vector", openAiOrRandVector("A sleek blue sedan"))
            .put("description", "A sleek blue sedan")
            .put("color", "blue")
            .put("type", "car")
            .put("price", 35000)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 3)
            .put("vector", openAiOrRandVector("A large red delivery truck"))
            .put("description", "A large red delivery truck")
            .put("color", "red")
            .put("type", "truck")
            .put("price", 80000)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 4)
            .put("vector", openAiOrRandVector("A blue pickup truck"))
            .put("description", "A blue pickup truck")
            .put("color", "blue")
            .put("type", "truck")
            .put("price", 45000)
            .build()
        )
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );

    result = ns2.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.ann("vector", openAiOrRandVector("car")))
        .limit(10)
        // Complex filter combining multiple conditions, see https://turbopuffer.com/docs/query for all options
        .filters(Filter.and(Filter.lt("price", 60000), Filter.eq("color", "blue")))
        .includeAttributes("description", "price")
        .build()
    );
    System.out.println(result.rows().get()); // car, then truck
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

var ns = tpuf.Namespace("vector-1-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// Basic vector search example
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("vector", OpenAiOrRandVector("A cat sleeping on a windowsill"))
                .Set("text", "A cat sleeping on a windowsill")
                .Set("category", "animal"),
            new Row()
                .Set("id", 2)
                .Set("vector", OpenAiOrRandVector("A playful kitten chasing a toy"))
                .Set("text", "A playful kitten chasing a toy")
                .Set("category", "animal"),
            new Row()
                .Set("id", 3)
                .Set("vector", OpenAiOrRandVector("An airplane flying through clouds"))
                .Set("text", "An airplane flying through clouds")
                .Set("category", "vehicle"),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);

var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Ann("vector", OpenAiOrRandVector("feline")),
        Limit = 2,
        IncludeAttributes = new List<string> { "text" },
    }
);
// Returns cat and kitten documents, sorted by vector similarity
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}

// Example of vector search with filters
var ns2 = tpuf.Namespace("vector-2-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));
await ns2.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("vector", OpenAiOrRandVector("A shiny red sports car"))
                .Set("description", "A shiny red sports car")
                .Set("color", "red")
                .Set("type", "car")
                .Set("price", 50000),
            new Row()
                .Set("id", 2)
                .Set("vector", OpenAiOrRandVector("A sleek blue sedan"))
                .Set("description", "A sleek blue sedan")
                .Set("color", "blue")
                .Set("type", "car")
                .Set("price", 35000),
            new Row()
                .Set("id", 3)
                .Set("vector", OpenAiOrRandVector("A large red delivery truck"))
                .Set("description", "A large red delivery truck")
                .Set("color", "red")
                .Set("type", "truck")
                .Set("price", 80000),
            new Row()
                .Set("id", 4)
                .Set("vector", OpenAiOrRandVector("A blue pickup truck"))
                .Set("description", "A blue pickup truck")
                .Set("color", "blue")
                .Set("type", "truck")
                .Set("price", 45000),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
    }
);

result = await ns2.Query(
    new NamespaceQueryParams
    {
        RankBy = RankBy.Ann("vector", OpenAiOrRandVector("car")),
        Limit = 10,
        // Complex filter combining multiple conditions, see https://turbopuffer.com/docs/query for all options
        Filters = Filter.And(Filter.Lt("price", 60000), Filter.Eq("color", "blue")),
        IncludeAttributes = new List<string> { "description", "price" },
    }
);
// car, then truck
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}

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

tpuf = Turbopuffer::Client.new(
  # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  api_key: ENV["TURBOPUFFER_API_KEY"],
  # Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
)

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

ns = tpuf.namespace("vector-1-example-rb")

# Basic vector search example
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: openai_or_rand_vector("A cat sleeping on a windowsill"),
      text: "A cat sleeping on a windowsill",
      category: "animal",
    },
    {
      id: 2,
      vector: openai_or_rand_vector("A playful kitten chasing a toy"),
      text: "A playful kitten chasing a toy",
      category: "animal",
    },
    {
      id: 3,
      vector: openai_or_rand_vector("An airplane flying through clouds"),
      text: "An airplane flying through clouds",
      category: "vehicle",
    },
  ],
  distance_metric: "cosine_distance",
)

result = ns.query(
  rank_by: ["vector", "ANN", openai_or_rand_vector("feline")],
  limit: 2,
  include_attributes: ["text"],
)
# Returns cat and kitten documents, sorted by vector similarity
puts result.rows

# Example of vector search with filters
ns = tpuf.namespace("vector-2-example-rb")
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: openai_or_rand_vector("A shiny red sports car"),
      description: "A shiny red sports car",
      color: "red",
      type: "car",
      price: 50000,
    },
    {
      id: 2,
      vector: openai_or_rand_vector("A sleek blue sedan"),
      description: "A sleek blue sedan",
      color: "blue",
      type: "car",
      price: 35000,
    },
    {
      id: 3,
      vector: openai_or_rand_vector("A large red delivery truck"),
      description: "A large red delivery truck",
      color: "red",
      type: "truck",
      price: 80000,
    },
    {
      id: 4,
      vector: openai_or_rand_vector("A blue pickup truck"),
      description: "A blue pickup truck",
      color: "blue",
      type: "truck",
      price: 45000,
    },
  ],
  distance_metric: "cosine_distance",
)

result = ns.query(
  rank_by: ["vector", "ANN", openai_or_rand_vector("car")],  # Embedding similar to "car"
  limit: 10,
  # Complex filter combining multiple conditions, see https://turbopuffer.com/docs/query for all options
  filters: ["And", [
    ["price", "Lt", 60000],
    ["color", "Eq", "blue"],
  ]],
  include_attributes: ["description", "price"],
)
puts result.rows # car, then truck
```
<!-- /multilang -->
