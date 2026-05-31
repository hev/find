---
title: "Hybrid Search"
description: "To improve search quality, multiple strategies can be used together. This is commonly referred to as hybrid search."
group: "Guides"
---

```
             ┌─{search.py,search.ts}─────────────────────────────────────────────────┐
             │                    ┌─turbopuffer queries────┐                         │
             │                    │  ┌───────────────────┐ │                         │
             │                    ├─▶│  Vector Query 1   │─┤                         │
             │ ┌ ─ ─ ─ ─ ─ ─ ─ ─  │  └───────────────────┘ │  ┌──────┐               │
┌──────────┐ │  Query Rewriting │ │  ┌───────────────────┐ │  │ Rank │   ┌ ─ ─ ─ ─ ┐ │
│User Query│─┼▶│(Language Model) ─┼─▶│  Vector Query 2   │─┼─▶│ Fuse │──▶  Re-Rank   │
└──────────┘ │  ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  └───────────────────┘ │  └──────┘   └ ─ ─ ─ ─ ┘ │
             │                    │  ┌───────────────────┐ │                         │
             │                    ├─▶│   Text Query 1    │─┤                         │
             │                    │  └───────────────────┘ │                         │
             │                    └────────────────────────┘                         │
             └───────────────────────────────────────────────────────────────────────┘
```

To improve search quality, multiple strategies can be used together. This is
commonly referred to as hybrid search.

turbopuffer supports vector search and BM25 full-text search.  Combining them
produces semantically relevant search results (vectors), as well as results
matching specific words or strings (i.e. product SKUs, email addresses, weighing
exact keywords highly).

Keep search logic in `{search.py, search.ts}`. Use turbopuffer for initial
retrieval to narrow millions of results to dozens for rank fusion and
re-ranking.

To improve search results further, we suggest:

* Using a re-ranker (such as [Cohere](https://cohere.com/rerank), [ZeroEntropy](https://docs.zeroentropy.dev/models#rerankers), [MixedBread](https://www.mixedbread.com/docs/stores/search/rerank), or [Voyage](https://docs.voyageai.com/docs/reranker))
* Building a test suite of queries and ideal results, and evaluate NDCG ([blog post](https://softwaredoug.com/blog/2021/02/21/what-is-a-judgment-list))
* Building a query rewriting layer ([LlamaIndex resource](https://docs.llamaindex.ai/en/stable/examples/query_transformations/query_transform_cookbook/))
* Trying various chunking strategies ([LangChain resource](https://docs.langchain.com/oss/javascript/integrations/splitters) [chonkie resource](https://github.com/chonkie-inc/chonkie))
* Trying [contextual retrieval](https://www.anthropic.com/news/contextual-retrieval), or otherwise rewriting the chunks to be embedded
* Adding additional multi-modal data to query, e.g. embeddings of the images ([Cohere image model](https://docs.cohere.com/v2/docs/embeddings#image-embeddings), [Voyage image model](https://docs.voyageai.com/docs/multimodal-embeddings))

<!-- multilang -->
```python
# $ pip install turbopuffer
import turbopuffer
from turbopuffer.types import Row, ID
import os
from typing import List

tpuf = turbopuffer.Turbopuffer(
    # API tokens are created in the dashboard: https://turbopuffer.com/dashboard
    api_key=os.getenv("TURBOPUFFER_API_KEY"),
    # Pick the right region: https://turbopuffer.com/docs/regions
    region="gcp-us-central1",
)

ns = tpuf.namespace(f'hybrid-example-py')

# Create an embedding with OpenAI, could be {Cohere, Voyage, Mixed Bread, ...}
# Requires OPENAI_API_KEY to be set (https://platform.openai.com/settings/organization/api-keys)
def openai_or_rand_vector(text: str) -> List[float]:
    if not os.getenv("OPENAI_API_KEY"): print("OPENAI_API_KEY not set, using random vectors"); return [__import__('random').random() for _ in range(2)]
    try: return __import__('openai').embeddings.create(model="text-embedding-3-small",input=text).data[0].embedding
    except ImportError: print("openai package not installed, using random vectors (`pip install openai`)"); return [__import__('random').random() for _ in range(2)]

# Upsert documents with both FTS and vector search capabilities
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'vector': openai_or_rand_vector('Muesli: A mix of raw oats, nuts and dried fruit served with cold milk'),
            'content': 'Muesli: A quick mix of raw oats, nuts and dried fruit served with cold milk',
        },
        {
            'id': 2,
            'vector': openai_or_rand_vector('Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare'),
            'content': 'Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare',
        },
        {
            'id': 3,
            'vector': openai_or_rand_vector('Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast'),
            'content': 'Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast',
        },
        {
            'id': 4,
            'vector': openai_or_rand_vector('Hot oatmeal is a quick and healthy breakfast'),
            'content': 'Hot oatmeal is a quick and healthy breakfast',
        },
        {
            'id': 5,
            'vector': openai_or_rand_vector("Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"),
            'content': 'Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!',
        },
    ],
    distance_metric="cosine_distance",
    schema={ "content": { "type": "string", "full_text_search": True } }
)
query = "quick breakfast like oatmeal but cold"
print("Ideal:", [1, 2, 3, 4, 5])

# ===============================================
# Multi-query: Vector Search + FTS
# combine both vector search and FTS in a single API call
# https://turbopuffer.com/docs/query#multi-queries
# ===============================================
response = ns.multi_query(
    queries=[
        {
            "rank_by": ("vector", "ANN", openai_or_rand_vector(query)),
            "limit": 10,
            "include_attributes": ["content"],
        },
        {
            "rank_by": ("content", "BM25", query),
            "limit": 10,
            "include_attributes": ["content"],
        },
    ]
)

# FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
# Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
# Ideal:  [1, 2, 3, 4, 5]
vector_result, fts_result = response.results[0].rows, response.results[1].rows
print("Vector:", [item.id for item in vector_result])
print("FTS:", [item.id for item in fts_result])

# ===============================================
# Rank Fusion
# ===============================================
# There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms

# That's why it's not built into turbopuffer (yet), as you may otherwise not be
# able to express the fusing you need.
def reciprocal_rank_fusion(result_lists, k = 60): # simple way to fuse results based on position
    scores = {}
    all_results = {}
    for results in result_lists:
        for rank, item in enumerate(results, start=1):
            scores[item.id] = scores.get(item.id, 0) + 1.0 / (k + rank)
            all_results[item.id] = item
    return [
        setattr(all_results[doc_id], '$dist', score) or all_results[doc_id]
        for doc_id, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]

# Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
# To fix that, we need a re-ranker to bring some more FLOPS to the table.
# Ideal: [1, 2, 3, 4, 5]
# Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
fused_results = reciprocal_rank_fusion([vector_result, fts_result])
print("Fused:", [item.id for item in fused_results])

# ===============================================
# Reranking
# ===============================================
# See alternative re-rankers turbopuffer.com/docs/hybrid
def cohere_rerank_or_unranked(results, query, k = None):
    if not os.getenv("COHERE_API_KEY"):
        print("Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results")
        return results
    try:
        co = __import__('cohere').Client(os.getenv("COHERE_API_KEY"))
        reranked = co.rerank(query=query, documents=[r.content for r in results], top_n=k or len(results)).results
        for r in reranked:
            results[r.index]['$dist'] = r.relevance_score
        return [results[r.index] for r in reranked]
    except ImportError:
        print("Warning: cohere package not installed (`pip install cohere`), returning unranked results")
        return results

# Weighs the slow overnight oats higher than the chia pudding, but not bad!
# Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
# Ideal: [1, 2, 3, 4, 5]
reranked_results = cohere_rerank_or_unranked(fused_results, query)
print("Reranked:", [item.id for item in reranked_results])
```
```typescript
// $ npm install @turbopuffer/turbopuffer
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { Row } from "@turbopuffer/turbopuffer/resources";

const tpuf = new Turbopuffer({
  // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
  apiKey: process.env.TURBOPUFFER_API_KEY,
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-central1",
});

const ns = tpuf.namespace(`hybrid-example-ts`);

// Upsert documents with both FTS and vector search capabilities
await ns.write({
  upsert_rows: [
    {
      id: 1,
      vector: await openaiOrRandVector("Muesli: A mix of raw oats, nuts and dried fruit served with cold milk"),
      content: "Muesli: A mix of raw oats, nuts and dried fruit served with cold milk",
    },
    {
      id: 2,
      vector: await openaiOrRandVector("Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"),
      content: "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare",
    },
    {
      id: 3,
      vector: await openaiOrRandVector("Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"),
      content: "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast",
    },
    {
      id: 4,
      vector: await openaiOrRandVector("Hot oatmeal is a quick and healthy breakfast"),
      content: "Hot oatmeal is a quick and healthy breakfast",
    },
    {
      id: 5,
      vector: await openaiOrRandVector("Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"),
      content: "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!",
    },
  ],
  distance_metric: "cosine_distance",
  schema: { content: { type: "string", full_text_search: true } },
});

const query = "quick breakfast like oatmeal but cold";
console.log("Ideal:", [1, 2, 3, 4, 5]);

// ===============================================
// Multi-query: Vector Search + FTS
// combine both vector search and FTS in a single API call
// https://turbopuffer.com/docs/query#multi-queries
const result = await ns.multiQuery({
  queries: [
    {
      rank_by: ["vector", "ANN", await openaiOrRandVector(query)],
      limit: 10,
      include_attributes: ["content"],
    },
    {
      rank_by: ["content", "BM25", query],
      limit: 10,
      include_attributes: ["content"],
    },
  ],
});

// FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
// Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
// Ideal:  [1, 2, 3, 4, 5]
const vectorResult = result.results[0].rows!;
const ftsResult = result.results[1].rows!;
console.log(
  "Vector:",
  vectorResult.map((item) => item.id),
);
console.log(
  "FTS:",
  ftsResult.map((item) => item.id),
);

// ===============================================
// Rank Fusion
// ===============================================
// There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms
// That's why it's not built into turbopuffer (yet), as you may otherwise not be
// able to express the fusing you need.
function reciprocalRankFusion(resultLists: any[], k: number = 60): any[] {
  const scores: { [key: string]: number } = {};
  const allResults: { [key: string]: any } = {};
  for (const results of resultLists) {
    for (let rank = 1; rank <= results.length; rank++) {
      const item = results[rank - 1];
      scores[item.id] = (scores[item.id] || 0) + 1.0 / (k + rank);
      allResults[item.id] = item;
    }
  }
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([docId, score]) => {
      allResults[docId].dist = score;
      return allResults[docId];
    });
}

// Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
// To fix that, we need a re-ranker to bring some more FLOPS to the table.
// Ideal: [1, 2, 3, 4, 5]
// Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
const fusedResults = reciprocalRankFusion([vectorResult, ftsResult]);
console.log(
  "Fused:",
  fusedResults.map((item) => item.id),
);

// ===============================================
// Reranking
// ===============================================
// See alternative re-rankers turbopuffer.com/docs/hybrid
async function cohereRerankOrUnranked(
  rows: Row[],
  query: string,
  k?: number,
): Promise<any[]> {
  if (!process.env.COHERE_API_KEY) {
    console.warn(
      "Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results",
    );
    return rows;
  }
  try {
    const { CohereClient } = await import("cohere-ai");
    const co = new CohereClient({ token: process.env.COHERE_API_KEY });
    const docs = rows.map((r) =>
      Object.fromEntries(
        Object.entries(r.attributes!).map(([k, v]) => [k, String(v)]),
      ),
    );

    const reranked = await co.rerank({
      query: query,
      documents: docs,
      topN: k || docs.length,
    });

    return reranked.results.map((r) => ({
      id: rows[r.index].id,
      score: r.relevanceScore,
    }));
  } catch (e) {
    console.warn(
      "Warning: cohere package not installed (`npm install cohere-ai`), returning unranked results",
    );
    return rows;
  }
}

// Weighs the slow overnight oats higher than the chia pudding, but not bad!
// Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
// Ideal: [1, 2, 3, 4, 5]
const cohereResults = await cohereRerankOrUnranked(fusedResults, query);
console.log(
  "Reranked:",
  cohereResults.map((item) => item.id),
);

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
	"sort"

	cohere "github.com/cohere-ai/cohere-go/v2"
	cohereclient "github.com/cohere-ai/cohere-go/v2/client"
	cohereoption "github.com/cohere-ai/cohere-go/v2/option"
	"github.com/openai/openai-go"
	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
	"github.com/turbopuffer/turbopuffer-go/v2/packages/respjson"
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

	ns := tpuf.Namespace("hybrid-example-go")

	// Upsert documents with both FTS and vector search capabilities
	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":      1,
					"vector":  openaiOrRandVector(ctx, "Muesli: A mix of raw oats, nuts and dried fruit served with cold milk"),
					"content": "Muesli: A quick mix of raw oats, nuts and dried fruit served with cold milk",
				},
				{
					"id":      2,
					"vector":  openaiOrRandVector(ctx, "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"),
					"content": "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare",
				},
				{
					"id":      3,
					"vector":  openaiOrRandVector(ctx, "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"),
					"content": "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast",
				},
				{
					"id":      4,
					"vector":  openaiOrRandVector(ctx, "Hot oatmeal is a quick and healthy breakfast"),
					"content": "Hot oatmeal is a quick and healthy breakfast",
				},
				{
					"id":      5,
					"vector":  openaiOrRandVector(ctx, "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"),
					"content": "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!",
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				"content": {
					Type:           "string",
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}

	query := "quick breakfast like oatmeal but cold"
	fmt.Print("Ideal: ", turbopuffer.PrettyPrint([]int{1, 2, 3, 4, 5}))

	// ===============================================
	// Multi-query: Vector Search + FTS
	// combine both vector search and FTS in a single API call
	// https://turbopuffer.com/docs/query#multi-queries
	res, err := ns.MultiQuery(
		ctx,
		turbopuffer.NamespaceMultiQueryParams{
			Queries: []turbopuffer.QueryParam{
				{
					RankBy: turbopuffer.NewRankByAnn("vector", openaiOrRandVector(ctx, query)),
					Limit: turbopuffer.LimitParam{
						Total: 10,
					},
					IncludeAttributes: turbopuffer.IncludeAttributesParam{
						StringArray: []string{"content"},
					},
				},
				{
					RankBy: turbopuffer.NewRankByTextBM25("content", query),
					Limit: turbopuffer.LimitParam{
						Total: 10,
					},
					IncludeAttributes: turbopuffer.IncludeAttributesParam{
						StringArray: []string{"content"},
					},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}

	// FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
	// Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
	// Ideal:  [1, 2, 3, 4, 5]
	vectorResult := res.Results[0].Rows
	ftsResult := res.Results[1].Rows
	fmt.Print("Vector: ", turbopuffer.PrettyPrint(resultIDs(vectorResult)))
	fmt.Print("FTS: ", turbopuffer.PrettyPrint(resultIDs(ftsResult)))

	// ===============================================
	// Rank Fusion
	// ===============================================
	// There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms
	// That's why it's not built into turbopuffer (yet), as you may otherwise not be
	// able to express the fusing you need.

	// Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
	// To fix that, we need a re-ranker to bring some more FLOPS to the table.
	// Ideal: [1, 2, 3, 4, 5]
	// Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
	fusedResults := reciprocalRankFusion([][]turbopuffer.Row{vectorResult, ftsResult}, 60)
	fmt.Print("Fused: ", turbopuffer.PrettyPrint(resultIDs(fusedResults)))

	// ===============================================
	// Reranking
	// ===============================================

	// Weighs the slow overnight oats higher than the chia pudding, but not bad!
	// Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
	// Ideal: [1, 2, 3, 4, 5]
	rerankedResults := cohereRerankOrUnranked(ctx, fusedResults, query)
	fmt.Print("Reranked: ", turbopuffer.PrettyPrint(resultIDs(rerankedResults)))
}

// Simple way to fuse results based on position
func reciprocalRankFusion(resultLists [][]turbopuffer.Row, k float32) []turbopuffer.Row {
	scores := make(map[any]float32)
	allResults := make(map[any]turbopuffer.Row)
	for _, results := range resultLists {
		for rank, item := range results {
			scores[item["id"]] += 1.0 / (k + float32(rank+1))
			allResults[item["id"]] = item
		}
	}
	ids := make([]any, 0, len(scores))
	for id := range scores {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool {
		return scores[ids[i]] > scores[ids[j]]
	})
	result := make([]turbopuffer.Row, len(ids))
	for i, id := range ids {
		result[i] = allResults[id]
		result[i]["$dist"] = scores[id]
	}
	return result
}

// See alternative re-rankers: turbopuffer.com/docs/hybrid
func cohereRerankOrUnranked(ctx context.Context, results []turbopuffer.Row, query string) []turbopuffer.Row {
	if os.Getenv("COHERE_API_KEY") == "" {
		print("Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results")
		return results
	}
	documents := make([]*cohere.RerankRequestDocumentsItem, len(results))
	for i, result := range results {
		documents[i] = &cohere.RerankRequestDocumentsItem{
			String: result["content"].(string),
		}
	}
	topN := len(documents)
	client := cohereclient.NewClient(cohereoption.WithToken(os.Getenv("COHERE_API_KEY")))
	res, err := client.Rerank(ctx, &cohere.RerankRequest{
		Query:     query,
		Documents: documents,
		TopN:      &topN,
	})
	if err != nil {
		panic(fmt.Sprintf("cohere rerank error: %v", err))
	}
	reranked := make([]turbopuffer.Row, len(res.Results))
	for i, result := range res.Results {
		reranked[i] = results[result.Index]
		reranked[i]["$dist"] = result.RelevanceScore
	}
	return reranked
}

func resultIDs(rows []turbopuffer.Row) []int64 {
	ids := make([]int64, len(rows))
	for i, item := range rows {
		var err error
		ids[i], err = item["id"].(respjson.Number).Int64()
		if err != nil {
			panic(fmt.Sprintf("failed to convert id to int64: %v", err))
		}
	}
	return ids
}
```
```java
// dependencies {
//     implementation("com.turbopuffer:turbopuffer-java:+")
//     implementation("com.openai:openai-java:+")
//     implementation("com.cohere:cohere-java:+")
// }

package com.turbopuffer.docs;

import com.cohere.api.*;
import com.cohere.api.requests.*;
import com.cohere.api.types.*;
import com.openai.client.okhttp.*;
import com.openai.errors.*;
import com.openai.models.embeddings.*;
import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;
import java.util.stream.*;

public class Hybrid {

  public static void main(String[] args) throws Exception {
    var tpuf = TurbopufferOkHttpClientAsync.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("hybrid-example-java");

    // Upsert documents with both FTS and vector search capabilities
    ns
      .write(
        NamespaceWriteParams.builder()
          .addUpsertRow(
            Row.builder()
              .put("id", 1)
              .put(
                "vector",
                openAiOrRandVector(
                  "Muesli: A mix of raw oats, nuts and dried fruit served with cold milk"
                )
              )
              .put(
                "content",
                "Muesli: A quick mix of raw oats, nuts and dried fruit served with cold milk"
              )
              .build()
          )
          .addUpsertRow(
            Row.builder()
              .put("id", 2)
              .put(
                "vector",
                openAiOrRandVector(
                  "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"
                )
              )
              .put(
                "content",
                "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"
              )
              .build()
          )
          .addUpsertRow(
            Row.builder()
              .put("id", 3)
              .put(
                "vector",
                openAiOrRandVector(
                  "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"
                )
              )
              .put(
                "content",
                "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"
              )
              .build()
          )
          .addUpsertRow(
            Row.builder()
              .put("id", 4)
              .put("vector", openAiOrRandVector("Hot oatmeal is a quick and healthy breakfast"))
              .put("content", "Hot oatmeal is a quick and healthy breakfast")
              .build()
          )
          .addUpsertRow(
            Row.builder()
              .put("id", 5)
              .put(
                "vector",
                openAiOrRandVector(
                  "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"
                )
              )
              .put(
                "content",
                "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"
              )
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
      )
      .join();

    var query = "quick breakfast like oatmeal but cold";
    System.out.println("Ideal: " + List.of(1, 2, 3, 4, 5));

    // ===============================================
    // Multi-query: Vector Search + FTS
    // combine both vector search and FTS in a single API call
    // https://turbopuffer.com/docs/query#multi-queries
    var multiQueryResult = ns
      .multiQuery(
        NamespaceMultiQueryParams.builder()
          .addQuery(
            Query.builder()
              .rankBy(RankBy.ann("vector", openAiOrRandVector(query)))
              .limit(10)
              .includeAttributes(IncludeAttributes.select("content"))
              .build()
          )
          .addQuery(
            Query.builder()
              .rankBy(RankByText.bm25("content", query))
              .limit(10)
              .includeAttributes(IncludeAttributes.select("content"))
              .build()
          )
          .build()
      )
      .get();

    // FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
    // Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
    // Ideal:  [1, 2, 3, 4, 5]
    var vectorResult = multiQueryResult.results().get(0).rows().get();
    var ftsResult = multiQueryResult.results().get(1).rows().get();
    System.out.println("Vector: " + resultIDs(vectorResult));
    System.out.println("FTS: " + resultIDs(ftsResult));

    // ===============================================
    // Rank Fusion
    // ===============================================
    // There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms
    // That's why it's not built into turbopuffer (yet), as you may otherwise not be
    // able to express the fusing you need.

    // Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
    // To fix that, we need a re-ranker to bring some more FLOPS to the table.
    // Ideal: [1, 2, 3, 4, 5]
    // Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
    var fusedResults = reciprocalRankFusion(List.of(vectorResult, ftsResult), 60);
    System.out.println("Fused: " + resultIDs(fusedResults));
    // ===============================================
    // Reranking
    // ===============================================

    // Weighs the slow overnight oats higher than the chia pudding, but not bad!
    // Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
    // Ideal: [1, 2, 3, 4, 5]
    var rerankedResults = cohereRerankOrUnranked(fusedResults, query);
    System.out.println("Reranked: " + resultIDs(rerankedResults));

    tpuf.close();
  }

  public static List<Row> cohereRerankOrUnranked(List<Row> results, String query) {
    if (System.getenv("COHERE_API_KEY") == null) {
      System.out.println(
        "Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results"
      );
      return results;
    }
    Cohere cohere = Cohere.builder().token(System.getenv("COHERE_API_KEY")).build();
    var rerankedResults = cohere.rerank(
      RerankRequest.builder()
        .query(query)
        .documents(
          results
            .stream()
            .map(row -> RerankRequestDocumentsItem.of(row.get("content").asStringOrThrow()))
            .collect(Collectors.toList())
        )
        .topN(results.size())
        .build()
    );
    var reranked = new ArrayList<Row>();
    for (var result : rerankedResults.getResults()) {
      var row = results
        .get(result.getIndex())
        .toBuilder()
        .put("$dist", JsonValue.from(result.getRelevanceScore()))
        .build();
      reranked.add(row);
    }
    return reranked;
  }

  public static List<Row> reciprocalRankFusion(List<List<Row>> resultLists, int k) {
    var scores = new HashMap<JsonValue, Double>();
    var allResults = new HashMap<JsonValue, Row>();
    for (var results : resultLists) {
      for (int rank = 0; rank < results.size(); rank++) {
        var item = results.get(rank);
        var id = item.get("id");
        scores.put(id, scores.getOrDefault(id, 0.0) + 1.0 / (k + rank + 1));
        allResults.put(id, item);
      }
    }
    return scores
      .entrySet()
      .stream()
      .sorted(Map.Entry.<JsonValue, Double>comparingByValue().reversed())
      .map(entry -> {
        var item = allResults.get(entry.getKey());
        item.put("$dist", JsonValue.from(entry.getValue()));
        return item;
      })
      .collect(Collectors.toList());
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

  public static List<JsonValue> resultIDs(List<Row> results) {
    return results.stream().map(row -> row.get("id")).collect(Collectors.toList());
  }
}
```
```cs
// dotnet add package Turbopuffer
// dotnet add package OpenAI
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
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

var ns = tpuf.Namespace("hybrid-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// Upsert documents with both FTS and vector search capabilities
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set(
                    "vector",
                    OpenAiOrRandVector(
                        "Muesli: A mix of raw oats, nuts and dried fruit served with cold milk"
                    )
                )
                .Set(
                    "content",
                    "Muesli: A quick mix of raw oats, nuts and dried fruit served with cold milk"
                ),
            new Row()
                .Set("id", 2)
                .Set(
                    "vector",
                    OpenAiOrRandVector(
                        "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"
                    )
                )
                .Set(
                    "content",
                    "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"
                ),
            new Row()
                .Set("id", 3)
                .Set(
                    "vector",
                    OpenAiOrRandVector(
                        "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"
                    )
                )
                .Set(
                    "content",
                    "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"
                ),
            new Row()
                .Set("id", 4)
                .Set("vector", OpenAiOrRandVector("Hot oatmeal is a quick and healthy breakfast"))
                .Set("content", "Hot oatmeal is a quick and healthy breakfast"),
            new Row()
                .Set("id", 5)
                .Set(
                    "vector",
                    OpenAiOrRandVector(
                        "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"
                    )
                )
                .Set(
                    "content",
                    "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"
                ),
        ],
        DistanceMetric = DistanceMetric.CosineDistance,
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["content"] = new AttributeSchemaConfig { Type = "string", FullTextSearch = true },
        },
    }
);

var query = "quick breakfast like oatmeal but cold";
Console.WriteLine($"Ideal: {string.Join(", ", new[] { 1, 2, 3, 4, 5 })}");

// ===============================================
// Multi-query: Vector Search + FTS
// combine both vector search and FTS in a single API call
// https://turbopuffer.com/docs/query#multi-queries
var multiQueryResult = await ns.MultiQuery(
    new NamespaceMultiQueryParams
    {
        Queries =
        [
            new Query
            {
                RankBy = RankBy.Ann("vector", OpenAiOrRandVector(query)),
                Limit = 10,
                IncludeAttributes = new List<string> { "content" },
            },
            new Query
            {
                RankBy = RankByText.BM25("content", query),
                Limit = 10,
                IncludeAttributes = new List<string> { "content" },
            },
        ],
    }
);

// FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
// Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
// Ideal:  [1, 2, 3, 4, 5]
var vectorResult = multiQueryResult.Results[0].GetRows().ToList();
var ftsResult = multiQueryResult.Results[1].GetRows().ToList();
Console.WriteLine($"Vector: {string.Join(", ", ResultIDs(vectorResult))}");
Console.WriteLine($"FTS: {string.Join(", ", ResultIDs(ftsResult))}");

// ===============================================
// Rank Fusion
// ===============================================
// There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms
// That's why it's not built into turbopuffer (yet), as you may otherwise not be
// able to express the fusing you need.

// Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
// To fix that, we need a re-ranker to bring some more FLOPS to the table.
// Ideal: [1, 2, 3, 4, 5]
// Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
var fusedResults = ReciprocalRankFusion([vectorResult, ftsResult], 60);
Console.WriteLine($"Fused: {string.Join(", ", ResultIDs(fusedResults))}");

// ===============================================
// Reranking
// ===============================================

// Weighs the slow overnight oats higher than the chia pudding, but not bad!
// Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
// Ideal: [1, 2, 3, 4, 5]
var rerankedResults = await CohereRerankOrUnranked(fusedResults, query);
Console.WriteLine($"Reranked: {string.Join(", ", ResultIDs(rerankedResults))}");

static async Task<List<Row>> CohereRerankOrUnranked(
    List<Row> results,
    string query
)
{
    if (Environment.GetEnvironmentVariable("COHERE_API_KEY") == null)
    {
        Console.WriteLine(
            "Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results"
        );
        return results;
    }
    using var http = new HttpClient();
    http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
        "Bearer",
        Environment.GetEnvironmentVariable("COHERE_API_KEY")
    );
    var documents = results
        .Select(row => row.Get<string>("content"))
        .ToList();
    var requestBody = JsonSerializer.Serialize(
        new
        {
            model = "rerank-v3.5",
            query,
            documents,
            top_n = results.Count,
        }
    );
    var response = await http.PostAsync(
        "https://api.cohere.com/v2/rerank",
        new StringContent(requestBody, Encoding.UTF8, "application/json")
    );
    response.EnsureSuccessStatusCode();
    using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    var reranked = new List<Row>();
    foreach (var result in doc.RootElement.GetProperty("results").EnumerateArray())
    {
        var index = result.GetProperty("index").GetInt32();
        var relevanceScore = result.GetProperty("relevance_score").GetDouble();
        var row = new Row(results[index]).Set("$dist", relevanceScore);
        reranked.Add(row);
    }
    return reranked;
}

static List<Row> ReciprocalRankFusion(List<List<Row>> resultLists, int k)
{
    var scores = new Dictionary<long, double>();
    var allResults = new Dictionary<long, Row>();
    foreach (var results in resultLists)
    {
        for (int rank = 0; rank < results.Count; rank++)
        {
            var item = results[rank];
            var id = item.Get<long>("id");
            scores[id] = scores.GetValueOrDefault(id, 0.0) + 1.0 / (k + rank + 1);
            allResults[id] = item;
        }
    }
    return scores
        .OrderByDescending(entry => entry.Value)
        .Select(entry => new Row(allResults[entry.Key]).Set("$dist", entry.Value))
        .ToList();
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

static List<long> ResultIDs(List<Row> results) =>
    results.Select(row => row.Get<long>("id")).ToList();
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

ns = tpuf.namespace("hybrid-example-rb")

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

# Upsert documents with both FTS and vector search capabilities
ns.write(
  upsert_rows: [
    {
      id: 1,
      vector: openai_or_rand_vector("Muesli: A mix of raw oats, nuts and dried fruit served with cold milk"),
      content: "Muesli: A quick mix of raw oats, nuts and dried fruit served with cold milk",
    },
    {
      id: 2,
      vector: openai_or_rand_vector("Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare"),
      content: "Classic chia seed pudding is a cold breakfast that takes 5 minutes to prepare",
    },
    {
      id: 3,
      vector: openai_or_rand_vector("Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast"),
      content: "Overnight oats: Mix oats with milk, refrigerate overnight for a delicious chilled breakfast",
    },
    {
      id: 4,
      vector: openai_or_rand_vector("Hot oatmeal is a quick and healthy breakfast"),
      content: "Hot oatmeal is a quick and healthy breakfast",
    },
    {
      id: 5,
      vector: openai_or_rand_vector("Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!"),
      content: "Breakfast sandwich: A little extra prep, but worth it on Sunday mornings!",
    },
  ],
  distance_metric: "cosine_distance",
  schema: { content: { type: "string", full_text_search: true } },
)

query = "quick breakfast like oatmeal but cold"
puts "Ideal: [1, 2, 3, 4, 5]"

# ===============================================
# Multi-query: Vector Search + FTS
# combine both vector search and FTS in a single API call
# https://turbopuffer.com/docs/query#multi-queries
# ===============================================
response = ns.multi_query(
  queries: [
    {
      rank_by: ["vector", "ANN", openai_or_rand_vector(query)],
      limit: 10,
      include_attributes: ["content"],
    },
    {
      rank_by: ["content", "BM25", query],
      limit: 10,
      include_attributes: ["content"],
    },
  ],
)

# FTS:    [4, 1, 2, 5, 3], matches Muesli well (NDCG: 0.72)
# Vector: [4, 3, 2, 1, 5], picks up on overnight oats, but not Muesli! (NDCG: 0.63)
# Ideal:  [1, 2, 3, 4, 5]
vector_result, fts_result = response.results[0].rows, response.results[1].rows
puts "FTS: #{fts_result.map(&:id)}"
puts "Vector: #{vector_result.map(&:id)}"

# ===============================================
# Rank Fusion
# ===============================================
# There are many ways to fuse the results, see https://github.com/AmenRa/ranx?tab=readme-ov-file#fusion-algorithms

# That's why it's not built into turbopuffer (yet), as you may otherwise not be
# able to express the fusing you need.
def reciprocal_rank_fusion(result_lists, k = 60) # simple way to fuse results based on position
  scores = {}
  all_results = {}
  result_lists.each do |results|
    results.each_with_index do |item, index|
      rank = index + 1
      scores[item.id] = scores.fetch(item.id, 0) + 1.0 / (k + rank)
      all_results[item.id] = item
    end
  end

  scores.sort_by { |_, score| -score }.map do |doc_id, score|
    result = all_results[doc_id]
    result[:$dist] = score
    result
  end
end

# Better than FTS or Vector alone, but still weighs the "hot oatmeal" highly.
# To fix that, we need a re-ranker to bring some more FLOPS to the table.
# Ideal: [1, 2, 3, 4, 5]
# Fused: [4, 1, 2, 3, 5] (NDCG: 0.73)
fused_results = reciprocal_rank_fusion([fts_result, vector_result])
puts "Fused: #{fused_results.map(&:id)}"

# ===============================================
# Reranking
# ===============================================
# See alternative re-rankers turbopuffer.com/docs/hybrid
def cohere_rerank_or_unranked(results, query, k = nil)
  if ENV["COHERE_API_KEY"].nil?
    puts "Warning: COHERE_API_KEY not set (https://dashboard.cohere.com/api-keys), returning unranked results"
    return results
  end

  begin
    require "cohere"
    co = Cohere::Client.new(api_key: ENV["COHERE_API_KEY"])
    reranked = co.rerank(
      model: "rerank-v3.5",
      query: query,
      documents: results.map(&:content),
      top_n: k || results.length,
    )
    reranked["results"].map do |r|
      index = r["index"]
      results[index][:$dist] = r["relevance_score"]
      results[index]
    end
  rescue LoadError
    puts "Warning: cohere gem not installed (`gem install cohere-ruby`), returning unranked results"
    results
  end
end

# Weighs the slow overnight oats higher than the chia pudding, but not bad!
# Cohere: [1, 3, 2, 4, 5] (NDCG: 0.97)
# Ideal: [1, 2, 3, 4, 5]
reranked_results = cohere_rerank_or_unranked(fused_results, query)
puts "Reranked: #{reranked_results.map(&:id)}"
```
<!-- /multilang -->
