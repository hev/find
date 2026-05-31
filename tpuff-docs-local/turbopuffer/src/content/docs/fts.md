---
title: "Full-Text Search Guide"
description: "turbopuffer supports BM25 full-text search for [string and []string types](/docs/writeschema). This guide shows how to configure and use full-text sea"
group: "Guides"
---

turbopuffer supports BM25 full-text search for [string and []string types](/docs/write#schema). This guide
shows how to configure and use full-text search with different options.

turbopuffer's full-text search engine has been written from the ground up for
the turbopuffer storage engine for low latency searches directly on object
storage.

For hybrid search combining both vector and BM25 results, see [Hybrid Search](/docs/hybrid-search).

For all available full-text search options, see the [Schema documentation](/docs/write#schema).

## Basic example

The simplest form of full-text search is on a single field of type `string`.

<!-- multilang -->
```bash
# Write some documents with a simple text field called "content".
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/fts-basic-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
  "upsert_rows": [
    { "id": 1, "content": "turbopuffer is a fast search engine with FTS, filtering, and vector search support" },
    { "id": 2, "content": "turbopuffer can store billions and billions of documents cheaper than any other search engine" },
    { "id": 3, "content": "turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster." }
  ],
   "schema": {
     "content": {
       "type": "string",
       "full_text_search": true
     }
   }
 }'

# Basic FTS search.
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/fts-basic-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["content", "BM25", "turbopuffer"],
   "limit": 10,
   "include_attributes": ["content"]
 }'
# [3, 1, 2] is the default BM25 ranking based on document length and
# term frequency

# Simple phrase matching, to limit results to documents that contain the terms
# "search" and "engine"
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/fts-basic-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["content", "BM25", "turbopuffer"],
   "filters": ["content", "ContainsAllTokens", "search engine"],
   "limit": 10,
   "include_attributes": ["content"]
 }'
# [1, 2] (same as above, but without document 3)

# To combine with vector search, see:
# https://turbopuffer.com/docs/hybrid-search
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

ns = tpuf.namespace(f'fts-basic-example-py')
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'content': 'turbopuffer is a fast search engine with FTS, filtering, and vector search support'
        },
        {
            'id': 2,
            'content': 'turbopuffer can store billions and billions of documents cheaper than any other search engine'
        },
        {
            'id': 3,
            'content': 'turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster.'
        }
    ],
    schema={
        'content': {
            'type': 'string',
            # Enable BM25 with default settings
            # For all config options, see https://turbopuffer.com/docs/write#schema
            'full_text_search': True
        }
    }
)

# Basic FTS search.
results = ns.query(
    rank_by=('content', 'BM25', 'turbopuffer'),
    limit=10,
    include_attributes=['content']
)
# [3, 1, 2] is the default BM25 ranking based on document length and
# term frequency
print(results)

# Simple phrase matching filter, to limit results to documents that contain the
# terms "search" and "engine"
results = ns.query(
    rank_by=('content', 'BM25', 'turbopuffer'),
    filters=('content', 'ContainsAllTokens', 'search engine'),
    limit=10,
    include_attributes=['content']
)
# [1, 2] (same as above, but without document 3)
print(results)

# To combine with vector search, see:
# https://turbopuffer.com/docs/hybrid-search
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

const ns = tpuf.namespace(`fts-basic-example-ts`);

await ns.write({
  upsert_rows: [
    {
      id: 1,
      content: "turbopuffer is a fast search engine with FTS, filtering, and vector search support",
    },
    {
      id: 2,
      content: "turbopuffer can store billions and billions of documents cheaper than any other search engine",
    },
    {
      id: 3,
      content: "turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster.",
    },
  ],
  schema: {
    content: {
      type: "string",
      // Enable BM25 with default settings
      // For all config options, see https://turbopuffer.com/docs/write#schema
      full_text_search: true,
    },
  },
});

// Basic FTS search, to combine with vector search, see https://turbopuffer.com/docs/hybrid-search
let results = await ns.query({
  rank_by: ["content", "BM25", "turbopuffer"],
  limit: 10,
  include_attributes: ["content"],
});
// [3, 1, 2] is the default BM25 ranking based on document length and term frequency
console.log(results);

// Simple phrase matching filter, to limit results to documents that contain the terms "search" and "engine"
results = await ns.query({
  rank_by: ["content", "BM25", "turbopuffer"],
  limit: 10,
  filters: ["content", "ContainsAllTokens", "search engine"],
  include_attributes: ["content"],
});
// [1, 2] (same as above, but without document 3)
console.log(results);
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

	ns := tpuf.Namespace("fts-basic-example-go")

	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":      1,
					"content": "turbopuffer is a fast search engine with FTS, filtering, and vector search support",
				},
				{
					"id":      2,
					"content": "turbopuffer can store billions and billions of documents cheaper than any other search engine",
				},
				{
					"id":      3,
					"content": "turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster.",
				},
			},
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				"content": {
					Type: "string",
					// Enable BM25 with default settings
					// For all config options, see https://turbopuffer.com/docs/write#schema
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}

	// Basic FTS search.
	results, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByTextBM25("content", "turbopuffer"),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"content"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	// [3, 1, 2] is the default BM25 ranking based on document length and
	// term frequency
	fmt.Print(turbopuffer.PrettyPrint(results))

	// Simple phrase matching filter, to limit results to documents that contain the
	// terms "search" and "engine"
	results, err = ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy:  turbopuffer.NewRankByTextBM25("content", "turbopuffer"),
			Filters: turbopuffer.NewFilterContainsAllTokens("content", "search engine"),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"content"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	// [1, 2] (same as above, but without document 3)
	fmt.Print(turbopuffer.PrettyPrint(results))

	// To combine with vector search, see:
	// https://turbopuffer.com/docs/hybrid-search
}
```
```java
// dependencies {
//     implementation("com.turbopuffer:turbopuffer-java:+")
// }

package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class FtsBasic {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // API tokens are created in the dashboard: https://turbopuffer.com/dashboard
      .apiKey(System.getenv("TURBOPUFFER_API_KEY"))
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("fts-basic-example-java");

    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put(
              "content",
              "turbopuffer is a fast search engine with FTS, filtering, and vector search support"
            )
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put(
              "content",
              "turbopuffer can store billions and billions of documents cheaper than any other search engine"
            )
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 3)
            .put(
              "content",
              "turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster."
            )
            .build()
        )
        .schema(
          Schema.builder()
            .put(
              "content",
              AttributeSchemaConfig.builder()
                .type("string")
                // Enable BM25 with default settings
                // For all config options, see https://turbopuffer.com/docs/write#schema
                .fullTextSearch(FullTextSearchConfig.defaults())
                .build()
            )
            .build()
        )
        .build()
    );

    // Basic FTS search.
    var queryResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", "turbopuffer"))
        .limit(10)
        .includeAttributes("content")
        .build()
    );
    // [3, 1, 2] is the default BM25 ranking based on document length and
    // term frequency
    System.out.println(queryResult.rows().get());

    // Simple phrase matching filter, to limit results to documents that contain the
    // terms "search" and "engine"
    queryResult = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", "turbopuffer"))
        .filters(Filter.containsAllTokens("content", "search engine"))
        .limit(10)
        .includeAttributes("content")
        .build()
    );
    // [1, 2] (same as above, but without document 3)
    System.out.println(queryResult.rows().get());
    // To combine with vector search, see:
    // https://turbopuffer.com/docs/hybrid-search
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

var ns = tpuf.Namespace("fts-basic-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set(
                    "content",
                    "turbopuffer is a fast search engine with FTS, filtering, and vector search support"
                ),
            new Row()
                .Set("id", 2)
                .Set(
                    "content",
                    "turbopuffer can store billions and billions of documents cheaper than any other search engine"
                ),
            new Row()
                .Set("id", 3)
                .Set(
                    "content",
                    "turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster."
                ),
        ],
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["content"] = new AttributeSchemaConfig
            {
                Type = "string",
                // Enable BM25 with default settings
                // For all config options, see https://turbopuffer.com/docs/write#schema
                FullTextSearch = true,
            },
        },
    }
);

// Basic FTS search.
var queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", "turbopuffer"),
        Limit = 10,
        IncludeAttributes = new List<string> { "content" },
    }
);
// [3, 1, 2] is the default BM25 ranking based on document length and
// term frequency
foreach (var row in queryResult.GetRows())
{
    Console.WriteLine(row);
}

// Simple phrase matching filter, to limit results to documents that contain the
// terms "search" and "engine"
queryResult = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", "turbopuffer"),
        Filters = Filter.ContainsAllTokens("content", "search engine"),
        Limit = 10,
        IncludeAttributes = new List<string> { "content" },
    }
);
// [1, 2] (same as above, but without document 3)
foreach (var row in queryResult.GetRows())
{
    Console.WriteLine(row);
}
// To combine with vector search, see:
// https://turbopuffer.com/docs/hybrid-search
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

ns = tpuf.namespace("fts-basic-example-rb")
ns.write(
  upsert_rows: [
    {
      id: 1,
      content: "turbopuffer is a fast search engine with FTS, filtering, and vector search support",
    },
    {
      id: 2,
      content: "turbopuffer can store billions and billions of documents cheaper than any other search engine",
    },
    {
      id: 3,
      content: "turbopuffer will support many more types of queries as it evolves. turbopuffer will only get faster.",
    },
  ],
  schema: {
    content: {
      type: "string",
      # Enable BM25 with default settings
      # For all config options, see https://turbopuffer.com/docs/write#schema
      full_text_search: true,
    },
  },
)

# Basic FTS search.
results = ns.query(
  rank_by: ["content", "BM25", "turbopuffer"],
  limit: 10,
  include_attributes: ["content"],
)
# [3, 1, 2] is the default BM25 ranking based on document length and
# term frequency
puts results.rows

# Simple phrase matching filter, to limit results to documents that contain the
# terms "search" and "engine"
results = ns.query(
  rank_by: ["content", "BM25", "turbopuffer"],
  filters: ["content", "ContainsAllTokens", "search engine"],
  limit: 10,
  include_attributes: ["content"],
)
# [1, 2] (same as above, but without document 3)
puts results.rows

# To combine with vector search, see:
# https://turbopuffer.com/docs/hybrid-search
```
<!-- /multilang -->

## Advanced example

You can use full-text search operators like [Sum] and [Product] to perform
a full-text search across multiple attributes simultaneously.

<!-- multilang -->
```bash
# Write some documents with a rich set of attributes.
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/fts-advanced-example-curl \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "upsert_rows": [
     {
       "id": 1,
       "title": "Getting Started with Python",
       "content": "Learn Python basics including variables, functions, and classes",
       "tags": ["python", "programming", "beginner"],
       "language": "en",
       "publish_date": 1709251200
     },
     {
       "id": 2,
       "title": "Advanced TypeScript Tips",
       "content": "Discover advanced TypeScript features and type system tricks",
       "tags": ["typescript", "javascript", "advanced"],
       "language": "en",
       "publish_date": 1709337600
     },
     {
       "id": 3,
       "title": "Python vs JavaScript",
       "content": "Compare Python and JavaScript for web development",
       "tags": ["python", "javascript", "comparison"],
       "language": "en",
       "publish_date": 1709424000
     }
   ],
   "schema": {
     "title": {
       "type": "string",
       "full_text_search": {
         "language": "english",
         "stemming": true,
         "remove_stopwords": true,
         "case_sensitive": false
       }
     },
     "content": {
       "type": "string",
       "full_text_search": {
         "language": "english",
         "stemming": true,
         "remove_stopwords": true
       }
     },
     "tags": {
       "type": "[]string",
       "full_text_search": {
         "stemming": false,
         "remove_stopwords": false,
         "case_sensitive": true
       }
     }
   }
 }'

# Advanced FTS search.
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/fts-advanced-example-curl/query \
  -X POST --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
   "rank_by": ["Sum", [
     ["Product", 3, ["title", "BM25", "python beginner"]],
     ["Product", 2, ["content", "BM25", "python beginner"]],
     ["tags", "BM25", "python beginner"]
   ]],
   "filters": ["And", [
     ["publish_date", "Gte", 1709251200],
     ["language", "Eq", "en"]
   ]],
   "limit": 10,
   "include_attributes": ["title", "content", "tags"]
 }'

# To combine with vector search, see: https://turbopuffer.com/docs/hybrid-search
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'fts-advanced-example-py')

# Write some documents with a rich set of attributes.
ns.write(
    upsert_rows=[
        {
            'id': 1,
            'title': 'Getting Started with Python',
            'content': 'Learn Python basics including variables, functions, and classes',
            'tags': ['python', 'programming', 'beginner'],
            'language': 'en',
            'publish_date': 1709251200
        },
        {
            'id': 2,
            'title': 'Advanced TypeScript Tips',
            'content': 'Discover advanced TypeScript features and type system tricks',
            'tags': ['typescript', 'javascript', 'advanced'],
            'language': 'en',
            'publish_date': 1709337600
        },
        {
            'id': 3,
            'title': 'Python vs JavaScript',
            'content': 'Compare Python and JavaScript for web development',
            'tags': ['python', 'javascript', 'comparison'],
            'language': 'en',
            'publish_date': 1709424000
        }
    ],
    schema={
        'title': {
            'type': 'string',
            'full_text_search': {
                # See all FTS indexing options at
                # https://turbopuffer.com/docs/write#param-full_text_search
                'language': 'english',
                'stemming': True,
                'remove_stopwords': True,
                'case_sensitive': False
            }
        },
        'content': {
            'type': 'string',
            'full_text_search': {
                'language': 'english',
                'stemming': True,
                'remove_stopwords': True
            }
        },
        'tags': {
            'type': '[]string',
            'full_text_search': {
                'stemming': False,
                'remove_stopwords': False,
                'case_sensitive': True
            }
        }
    }
)

# Advanced FTS search.
# In this example, hits on `title` and `tags` are weighted / boosted higher than
# hits on `content`.
result = ns.query(
    # See all FTS query options at https://turbopuffer.com/docs/query
    rank_by=('Sum', (
        ('Product', 3, ('title', 'BM25', 'python beginner')),
        ('Product', 2, ('tags', 'BM25', 'python beginner')),
        ('content', 'BM25', 'python beginner')
    )),
    filters=('And', (
        ('publish_date', 'Gte', 1709251200),
        ('language', 'Eq', 'en'),
    )),
    limit=10,
    include_attributes=['title', 'content', 'tags']
)
print(result.rows)

# To combine with vector search, see:
# https://turbopuffer.com/docs/hybrid-search
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`fts-advanced-example-ts`);

// Write some documents with a rich set of attributes.
await ns.write({
  upsert_rows: [
    {
      id: 1,
      title: "Getting Started with Python",
      content: "Learn Python basics including variables, functions, and classes",
      tags: ["python", "programming", "beginner"],
      language: "en",
      publish_date: 1709251200,
    },
    {
      id: 2,
      title: "Advanced TypeScript Tips",
      content: "Discover advanced TypeScript features and type system tricks",
      tags: ["typescript", "javascript", "advanced"],
      language: "en",
      publish_date: 1709337600,
    },
    {
      id: 3,
      title: "Python vs JavaScript",
      content: "Compare Python and JavaScript for web development",
      tags: ["python", "javascript", "comparison"],
      language: "en",
      publish_date: 1709424000,
    },
  ],
  schema: {
    title: {
      type: "string",
      full_text_search: {
        // See all FTS indexing options at
        // https://turbopuffer.com/docs/write#param-full_text_search
        language: "english",
        stemming: true,
        remove_stopwords: true,
        case_sensitive: false,
      },
    },
    content: {
      type: "string",
      full_text_search: {
        language: "english",
        stemming: true,
        remove_stopwords: true,
      },
    },
    tags: {
      type: "[]string",
      full_text_search: {
        stemming: false,
        remove_stopwords: false,
        case_sensitive: true,
      },
    },
  },
});

// Advanced FTS search.
// In this example, hits on `title` and `tags` are weighted / boosted higher
// than hits on `content`.
const results = await ns.query({
  // See all FTS query options at https://turbopuffer.com/docs/query
  rank_by: [
    "Sum",
    [
      ["Product", 3, ["title", "BM25", "python beginner"]],
      ["Product", 2, ["tags", "BM25", "python beginner"]],
      ["content", "BM25", "python beginner"],
    ],
  ],
  filters: [
    "And",
    [
      ["publish_date", "Gte", 1709251200],
      ["language", "Eq", "en"],
    ],
  ],
  limit: 10,
  include_attributes: ["title", "content", "tags"],
});
console.log(results);

// To combine with vector search, see:
// https://turbopuffer.com/docs/hybrid-search
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

	ns := tpuf.Namespace("fts-advanced-example-go")

	// Write some documents with a rich set of attributes.
	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":           1,
					"title":        "Getting Started with Python",
					"content":      "Learn Python basics including variables, functions, and classes",
					"tags":         []string{"python", "programming", "beginner"},
					"language":     "en",
					"publish_date": 1709251200,
				},
				{
					"id":           2,
					"title":        "Advanced TypeScript Tips",
					"content":      "Discover advanced TypeScript features and type system tricks",
					"tags":         []string{"typescript", "javascript", "advanced"},
					"language":     "en",
					"publish_date": 1709337600,
				},
				{
					"id":           3,
					"title":        "Python vs JavaScript",
					"content":      "Compare Python and JavaScript for web development",
					"tags":         []string{"python", "javascript", "comparison"},
					"language":     "en",
					"publish_date": 1709424000,
				},
			},
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				"title": {
					Type: "string",
					// See all FTS indexing options at
					// https://turbopuffer.com/docs/write#param-full_text_search
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{
						Language:        turbopuffer.LanguageEnglish,
						Stemming:        turbopuffer.Bool(true),
						RemoveStopwords: turbopuffer.Bool(true),
						CaseSensitive:   turbopuffer.Bool(false),
					},
				},
				"content": {
					Type: "string",
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{
						Language:        turbopuffer.LanguageEnglish,
						Stemming:        turbopuffer.Bool(true),
						RemoveStopwords: turbopuffer.Bool(true),
					},
				},
				"tags": {
					Type: "[]string",
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{
						Stemming:        turbopuffer.Bool(false),
						RemoveStopwords: turbopuffer.Bool(false),
						CaseSensitive:   turbopuffer.Bool(true),
					},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}

	// Advanced FTS search.
	// In this example, hits on `title` and `tags` are weighted / boosted higher than
	// hits on `content`.
	result, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			// See all FTS query options at https://turbopuffer.com/docs/query
			RankBy: turbopuffer.NewRankByTextSum([]turbopuffer.RankByText{
				turbopuffer.NewRankByTextProduct(3, turbopuffer.NewRankByTextBM25("title", "python beginner")),
				turbopuffer.NewRankByTextProduct(2, turbopuffer.NewRankByTextBM25("tags", "python beginner")),
				turbopuffer.NewRankByTextBM25("content", "python beginner"),
			}),
			Filters: turbopuffer.NewFilterAnd([]turbopuffer.Filter{
				turbopuffer.NewFilterGte("publish_date", 1709251200),
				turbopuffer.NewFilterEq("language", "en"),
			}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
			IncludeAttributes: turbopuffer.IncludeAttributesParam{
				StringArray: []string{"title", "content", "tags"},
			},
		},
	)
	if err != nil {
		panic(err)
	}
	fmt.Print(turbopuffer.PrettyPrint(result.Rows))

	// To combine with vector search, see:
	// https://turbopuffer.com/docs/hybrid-search
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class FtsAdvanced {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("fts-advanced-example-java");

    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("title", "Getting Started with Python")
            .put("content", "Learn Python basics including variables, functions, and classes")
            .put("tags", List.of("python", "programming", "beginner"))
            .put("language", "en")
            .put("publish_date", 1709251200)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("title", "Advanced TypeScript Tips")
            .put("content", "Discover advanced TypeScript features and type system tricks")
            .put("tags", List.of("typescript", "javascript", "advanced"))
            .put("language", "en")
            .put("publish_date", 1709337600)
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 3)
            .put("title", "Python vs JavaScript")
            .put("content", "Compare Python and JavaScript for web development")
            .put("tags", List.of("python", "javascript", "comparison"))
            .put("language", "en")
            .put("publish_date", 1709424000)
            .build()
        )
        .schema(
          Schema.builder()
            .put(
              "title",
              AttributeSchemaConfig.builder()
                .type("string")
                .fullTextSearch(
                  FullTextSearchConfig.builder()
                    .language(Language.ENGLISH)
                    .stemming(true)
                    .removeStopwords(true)
                    .caseSensitive(false)
                    .build()
                )
                .build()
            )
            .put(
              "content",
              AttributeSchemaConfig.builder()
                .type("string")
                .fullTextSearch(
                  FullTextSearchConfig.builder()
                    .language(Language.ENGLISH)
                    .stemming(true)
                    .removeStopwords(true)
                    .build()
                )
                .build()
            )
            .put(
              "tags",
              AttributeSchemaConfig.builder()
                .type("[]string")
                .fullTextSearch(
                  FullTextSearchConfig.builder()
                    .stemming(false)
                    .removeStopwords(false)
                    .caseSensitive(true)
                    .build()
                )
                .build()
            )
            .build()
        )
        .build()
    );

    // Advanced FTS search.
    // In this example, hits on `title` and `tags` are weighted / boosted higher than
    // hits on `content`.
    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(
          RankByText.sum(
            RankByText.product(3, RankByText.bm25("title", "python beginner")),
            RankByText.product(2, RankByText.bm25("tags", "python beginner")),
            RankByText.bm25("content", "python beginner")
          )
        )
        .filters(Filter.and(Filter.gte("publish_date", 1709251200), Filter.eq("language", "en")))
        .limit(10)
        .includeAttributes("title", "content", "tags")
        .build()
    );
    System.out.println(result.rows().get());
    // To combine with vector search, see:
    // https://turbopuffer.com/docs/hybrid-search
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

var ns = tpuf.Namespace("fts-advanced-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row()
                .Set("id", 1)
                .Set("title", "Getting Started with Python")
                .Set("content", "Learn Python basics including variables, functions, and classes")
                .Set("tags", new[] { "python", "programming", "beginner" })
                .Set("language", "en")
                .Set("publish_date", 1709251200),
            new Row()
                .Set("id", 2)
                .Set("title", "Advanced TypeScript Tips")
                .Set("content", "Discover advanced TypeScript features and type system tricks")
                .Set("tags", new[] { "typescript", "javascript", "advanced" })
                .Set("language", "en")
                .Set("publish_date", 1709337600),
            new Row()
                .Set("id", 3)
                .Set("title", "Python vs JavaScript")
                .Set("content", "Compare Python and JavaScript for web development")
                .Set("tags", new[] { "python", "javascript", "comparison" })
                .Set("language", "en")
                .Set("publish_date", 1709424000),
        ],
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["title"] = new AttributeSchemaConfig
            {
                Type = "string",
                FullTextSearch = new FullTextSearchConfig
                {
                    Language = Language.English,
                    Stemming = true,
                    RemoveStopwords = true,
                    CaseSensitive = false,
                },
            },
            ["content"] = new AttributeSchemaConfig
            {
                Type = "string",
                FullTextSearch = new FullTextSearchConfig
                {
                    Language = Language.English,
                    Stemming = true,
                    RemoveStopwords = true,
                },
            },
            ["tags"] = new AttributeSchemaConfig
            {
                Type = "[]string",
                FullTextSearch = new FullTextSearchConfig
                {
                    Stemming = false,
                    RemoveStopwords = false,
                    CaseSensitive = true,
                },
            },
        },
    }
);

// Advanced FTS search.
// In this example, hits on `title` and `tags` are weighted / boosted higher than
// hits on `content`.
var result = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.Sum(
            RankByText.Product(3, RankByText.BM25("title", "python beginner")),
            RankByText.Product(2, RankByText.BM25("tags", "python beginner")),
            RankByText.BM25("content", "python beginner")
        ),
        Filters = Filter.And(
            Filter.Gte("publish_date", 1709251200),
            Filter.Eq("language", "en")
        ),
        Limit = 10,
        IncludeAttributes = new List<string> { "title", "content", "tags" },
    }
);
foreach (var row in result.GetRows())
{
    Console.WriteLine(row);
}
// To combine with vector search, see:
// https://turbopuffer.com/docs/hybrid-search
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("fts-advanced-example-rb")

# Write some documents with a rich set of attributes.
ns.write(
  upsert_rows: [
    {
      id: 1,
      title: "Getting Started with Python",
      content: "Learn Python basics including variables, functions, and classes",
      tags: ["python", "programming", "beginner"],
      language: "en",
      publish_date: 1709251200,
    },
    {
      id: 2,
      title: "Advanced TypeScript Tips",
      content: "Discover advanced TypeScript features and type system tricks",
      tags: ["typescript", "javascript", "advanced"],
      language: "en",
      publish_date: 1709337600,
    },
    {
      id: 3,
      title: "Python vs JavaScript",
      content: "Compare Python and JavaScript for web development",
      tags: ["python", "javascript", "comparison"],
      language: "en",
      publish_date: 1709424000,
    },
  ],
  schema: {
    title: {
      type: "string",
      full_text_search: {
        # See all FTS indexing options at
        # https://turbopuffer.com/docs/write#param-full_text_search
        language: "english",
        stemming: true,
        remove_stopwords: true,
        case_sensitive: false,
      },
    },
    content: {
      type: "string",
      full_text_search: {
        language: "english",
        stemming: true,
        remove_stopwords: true,
      },
    },
    tags: {
      type: "[]string",
      full_text_search: {
        stemming: false,
        remove_stopwords: false,
        case_sensitive: true,
      },
    },
  },
)

# Advanced FTS search.
# In this example, hits on `title` and `tags` are weighted / boosted higher than
# hits on `content`.
result = ns.query(
  # See all FTS query options at https://turbopuffer.com/docs/query
  rank_by: ["Sum", [
    ["Product", 3, ["title", "BM25", "python beginner"]],
    ["Product", 2, ["tags", "BM25", "python beginner"]],
    ["content", "BM25", "python beginner"],
  ]],
  filters: ["And", [
    ["publish_date", "Gte", 1709251200],
    ["language", "Eq", "en"],
  ]],
  limit: 10,
  include_attributes: ["title", "content", "tags"],
)
puts result.rows

# To combine with vector search, see:
# https://turbopuffer.com/docs/hybrid-search
```
<!-- /multilang -->

## Custom tokenization

When turbopuffer's built-in tokenizers aren't sufficient, use the
`pre_tokenized_array` [tokenizer](/docs/fts/#tokenizers)
to perform client side tokenization using arbitrary logic.

<!-- multilang -->
```python
import turbopuffer
from typing import List

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

# A simple word tokenizer that preserves hyphens instead of splitting on them.
def tokenize(text: str) -> List[str]:
    # Replace all characters besides alphanumeric and '-' with spaces.
    cleaned = ""
    for ch in text:
        if ch.isalnum() or ch in "-":
            cleaned += ch
        else:
            cleaned += str(" ")
    # Lowercase and split on spaces.
    return cleaned.lower().split()

# Write some sample data.
ns = tpuf.namespace(f'fts-custom-tokenization-example-py')
ns.write(
    upsert_rows=[
        {"id": 1, "content": tokenize("We hold these truths to be self-evident.")},
        {"id": 2, "content": tokenize("For my own self, it seemed evident.")},
    ],
    schema={
        'content': {
            'type': '[]string',
            'full_text_search': {'tokenizer': 'pre_tokenized_array'}
        }
    }
)

# Query for "self" and "evident".
results = ns.query(
    # Notice that the BM25 operator now expects a list of tokens, not a string.
    rank_by=('content', 'BM25', ['self', 'evident']),
    limit=10,
)
# Only document 2 is matched, because document 1 has the token "self-evident"
# but neither the token "self" nor "evident".
print(results)

# Query for "self-evident".
results = ns.query(
    rank_by=('content', 'BM25', ['self-evident']),
    limit=10,
)
# Now only document 1 is matched.
print(results)

# To accept string queries, simply apply the tokenizer to the query string
# before passing it to the `BM25` operator.
def query_string(query: str):
    return ns.query(
        rank_by=('content', 'BM25', tokenize(query)),
        limit=10,
    )
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

// A simple word tokenizer that preserves hyphens instead of splitting on them.
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9-]+/).filter(s => s.length > 0);
}

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

// Write some sample data.
const ns = tpuf.namespace(`fts-custom-tokenization-example-ts`);
await ns.write({
  upsert_rows: [
    { id: 1, content: tokenize("We hold these truths to be self-evident.") },
    { id: 2, content: tokenize("For my own self, it seemed evident.") },
  ],
  schema: {
    content: {
      type: "[]string",
      full_text_search: { tokenizer: "pre_tokenized_array" }
    }
  }
});

// Query for "self" and "evident".
let results = await ns.query({
  // Notice that the BM25 operator now expects a list of tokens, not a string
  rank_by: ["content", "BM25", ["self", "evident"]],
  limit: 10,
});
// Only document 2 is matched, because document 1 has the token "self-evident"
// but neither the token "self" nor "evident".
console.log(results);

// Query for "self-evident".
results = await ns.query({
  rank_by: ["content", "BM25", ["self-evident"]],
  limit: 10,
});
// Now only document 1 is matched.
console.log(results);

// To handle string queries, simply apply the tokenizer to the query
// string before passing it to the `BM25` operator.
async function queryString(query: string) {
  return await ns.query({
    rank_by: ["content", "BM25", tokenize(query)],
    limit: 10,
  });
}
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

// A simple word tokenizer that preserves hyphens instead of splitting on them.
func tokenize(text string) []string {
	// Replace all characters besides alphanumeric and '-' with spaces.
	re := regexp.MustCompile(`[^a-zA-Z0-9-]+`)
	cleaned := re.ReplaceAllString(text, " ")
	// Lowercase and split on spaces.
	tokens := strings.Fields(strings.ToLower(cleaned))
	return tokens
}

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	// Write some sample data.
	ns := tpuf.Namespace("fts-custom-tokenization-example-go")
	_, err := ns.Write(
		ctx,
		turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":      1,
					"content": tokenize("We hold these truths to be self-evident."),
				},
				{
					"id":      2,
					"content": tokenize("For my own self, it seemed evident."),
				},
			},
			Schema: map[string]turbopuffer.AttributeSchemaConfigParam{
				"content": {
					Type: "[]string",
					FullTextSearch: &turbopuffer.FullTextSearchConfigParam{
						Tokenizer: turbopuffer.TokenizerPreTokenizedArray,
					},
				},
			},
		},
	)
	if err != nil {
		panic(err)
	}

	// Query for "self" and "evident".
	results, err := ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			// Notice that the BM25 operator now expects a list of tokens, not a string.
			RankBy: turbopuffer.NewRankByTextBM25Array("content", []string{"self", "evident"}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		},
	)
	if err != nil {
		panic(err)
	}
	// Only document 2 is matched, because document 1 has the token "self-evident"
	// but neither the token "self" nor "evident".
	fmt.Print(turbopuffer.PrettyPrint(results))

	// Query for "self-evident".
	results, err = ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByTextBM25Array("content", []string{"self-evident"}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		},
	)
	if err != nil {
		panic(err)
	}
	// Now only document 1 is matched.
	fmt.Print(turbopuffer.PrettyPrint(results))
}

// To accept string queries, simply apply the tokenizer to the query
// string before passing it to the `BM25` operator.
func queryString(
	ctx context.Context,
	ns turbopuffer.Namespace,
	query string,
) (*turbopuffer.NamespaceQueryResponse, error) {
	return ns.Query(
		ctx,
		turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByTextBM25Array("content", tokenize(query)),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		},
	)
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.*;
import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class FtsCustomTokenization {

  // A simple word tokenizer that preserves hyphens instead of splitting on them.
  public static List<String> tokenize(String text) {
    // Replace all characters besides alphanumeric and '-' with spaces.
    String cleaned = text.replaceAll("[^a-zA-Z0-9-]", " ");
    // Lowercase and split on spaces.
    return List.of(cleaned.toLowerCase().split(" "));
  }

  public static void main(String[] args) {
    var client = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = client.namespace("fts-custom-tokenization-example-java");

    // Write some sample data.
    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(
          Row.builder()
            .put("id", 1)
            .put("content", tokenize("We hold these truths to be self-evident."))
            .build()
        )
        .addUpsertRow(
          Row.builder()
            .put("id", 2)
            .put("content", tokenize("For my own self, it seemed evident."))
            .build()
        )
        .schema(
          Schema.builder()
            .put(
              "content",
              AttributeSchemaConfig.builder()
                .type("[]string")
                .fullTextSearch(
                  FullTextSearchConfig.builder().tokenizer(Tokenizer.PRE_TOKENIZED_ARRAY).build()
                )
                .build()
            )
            .build()
        )
        .build()
    );

    // Query for "self" and "evident".
    var results = ns.query(
      // Notice that the BM25 operator now expects a list of tokens, not a
      // string.
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", List.of("self", "evident")))
        .limit(10)
        .build()
    );
    // Only document 2 is matched, because document 1 has the token
    // "self-evident" but neither the token "self" nor "evident".
    System.out.println(results.rows().get());

    // Query for "self-evident".
    results = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", List.of("self-evident")))
        .limit(10)
        .build()
    );
    // Now only document 1 is matched.
    System.out.println(results.rows().get());
  }

  // To accept string queries, simply apply the tokenizer to the query string
  // before passing it to the `BM25` operator.
  public static void queryString(Namespace ns, String query) {
    ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankByText.bm25("content", tokenize(query)))
        .limit(10)
        .build()
    );
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;
using Turbopuffer.Services;

using var client = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = client.Namespace("fts-custom-tokenization-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// Write some sample data.
await ns.Write(
    new NamespaceWriteParams
    {
        UpsertRows =
        [
            new Row().Set("id", 1).Set("content", Tokenize("We hold these truths to be self-evident.")),
            new Row().Set("id", 2).Set("content", Tokenize("For my own self, it seemed evident.")),
        ],
        Schema = new Dictionary<string, AttributeSchemaConfig>
        {
            ["content"] = new AttributeSchemaConfig
            {
                Type = "[]string",
                FullTextSearch = new FullTextSearchConfig
                {
                    Tokenizer = Tokenizer.PreTokenizedArray,
                },
            },
        },
    }
);

// Query for "self" and "evident".
var results = await ns.Query(
    // Notice that the BM25 operator now expects a list of tokens, not a
    // string.
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", new[] { "self", "evident" }),
        Limit = 10,
    }
);
// Only document 2 is matched, because document 1 has the token
// "self-evident" but neither the token "self" nor "evident".
foreach (var row in results.GetRows())
{
    Console.WriteLine(row);
}

// Query for "self-evident".
results = await ns.Query(
    new NamespaceQueryParams
    {
        RankBy = RankByText.BM25("content", new[] { "self-evident" }),
        Limit = 10,
    }
);
// Now only document 1 is matched.
foreach (var row in results.GetRows())
{
    Console.WriteLine(row);
}

// A simple word tokenizer that preserves hyphens instead of splitting on them.
static List<string> Tokenize(string text)
{
    // Replace all characters besides alphanumeric and '-' with spaces.
    string cleaned = Regex.Replace(text, "[^a-zA-Z0-9-]", " ");
    // Lowercase and split on spaces.
    return cleaned.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
}

// To accept string queries, simply apply the tokenizer to the query string
// before passing it to the `BM25` operator.
static async Task QueryString(INamespaceService ns, string query)
{
    await ns.Query(
        new NamespaceQueryParams
        {
            RankBy = RankByText.BM25("content", Tokenize(query)),
            Limit = 10,
        }
    );
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

# A simple word tokenizer that preserves hyphens instead of splitting on them.
def tokenize(text)
  text.downcase.split(/[^a-zA-Z0-9\-]+/).filter { |s| s.length > 0 }
end

# Write some sample data.
ns = tpuf.namespace("fts-custom-tokenization-example-rb")
ns.write(
  upsert_rows: [
    { id: 1, content: tokenize("We hold these truths to be self-evident.") },
    { id: 2, content: tokenize("For my own self, it seemed evident.") },
  ],
  schema: {
    content: {
      type: "[]string",
      full_text_search: { tokenizer: "pre_tokenized_array" },
    },
  },
)

# Query for "self" and "evident".
results = ns.query(
  # Notice that the BM25 operator now expects a list of tokens, not a string.
  rank_by: ["content", "BM25", ["self", "evident"]],
  limit: 10,
)
# Only document 2 is matched, because document 1 has the token "self-evident"
# but neither the token "self" nor "evident".
puts results.rows

# Query for "self-evident".
results = ns.query(
  rank_by: ["content", "BM25", ["self-evident"]],
  limit: 10,
)
# Now only document 1 is matched.
puts results.rows

# To accept string queries, simply apply the tokenizer to the query string
# before passing it to the `BM25` operator.
def query_string(ns, query)
  ns.query(
    rank_by: ["content", "BM25", tokenize(query)],
    limit: 10,
  )
end
```
<!-- /multilang -->

[Sum]: /docs/query#fts-operators
[Product]: /docs/query#field-weightsboosts

## Supported languages

turbopuffer currently supports language-aware stemming and stopword removal for
full-text search. The following languages are supported:

```
arabic              danish     dutch        english (default)   finnish
french              german     greek        hungarian           italian
norwegian           portuguese romanian     russian             spanish
swedish             tamil      turkish
```

For latin-script languages with diacritics (e.g. french, spanish), consider
enabling [`ascii_folding`](/docs/write#param-full_text_search) in your BM25
params.

Other languages can be supported by [contacting us](/contact).

## Tokenizers

- `word_v3` (default for new namespaces)
- `word_v2`
- `word_v1`
- `word_v0`
- `pre_tokenized_array`

The default tokenizer is periodically upgraded. If your application relies
on specific tokenization behavior, you should explicitly specify a tokenizer
in the [schema](/docs/write#param-full_text_search).

The word_v3 tokenizer uses [Unicode v17.0 text segmentation rules](https://www.unicode.org/reports/tr29/tr29-47.html) for accurate segmentation across most languages, scripts, and emojis. Recommended for most use cases.

The `word_v2` tokenizer forms tokens from ideographic codepoints, contiguous
sequences of alphanumeric codepoints, and sequences of emoji codepoints that
form a single glyph. Codepoints that are not alphanumeric, ideographic, or an
emoji are discarded. Codepoints are classified according to Unicode v16.0.

The `word_v1` tokenizer works like the `word_v2` tokenizer, except that
ideographic codepoints are treated as alphanumeric codepoint. Codepoints are
classified according to Unicode v10.0.

The `word_v0` tokenizer works like the `word_v1` tokenizer, except that emoji
codepoints are discarded.

The `pre_tokenized_array` tokenizer is a special tokenizer that indicates that
you want to perform your own tokenization. This tokenizer can only be used on
attributes of type `[]string`; each string in the array is interpreted as a
token. When this tokenizer is active, queries using the `BM25` or
`ContainsAllTokens` operators must supply a query operand of type `[]string`
rather than `string`; each string in the array is interpreted as a token. Tokens
are always matched case sensitively, without stemming or stopword removal. You
cannot specify `language`, `stemming: true`, `remove_stopwords: true`, or
`case_sensitive: false` when using this tokenizer.

New tokenizers can be requested by [contacting us](/contact).

## Fuzzy matching

turbopuffer supports fuzzy string matching within a specified [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance) via the [Fuzzy filter](/docs/query#param-Fuzzy). This can be used as a filter directly, or within a rank-by expression as a [Rank by filter](/docs/query#rank-by-filter), possibly in conjunction with other expressions:

```json
{
  "rank_by": ["Sum", [
    ["Product", 3, ["company_name", "Glob", "*turbopufer*"]],
    ["company_name", "Fuzzy", "turbopufer", { "max_edit_distance": [
      { "min_query_chars": 6, "distance": 1 }
    ]}]
  ]],
  "limit": 10
}
```

This query will prioritize values that contain exactly "turbopufer" as a substring, while simultaneously ensuring that values that contain a substring that is within a given edit distance are returned.

turbopuffer does not support per-token fuzziness, e.g. within a BM25 query. Prefer using a spell-checker / query-rewriting layer to correct typos before retrieving hits, or consider using [hybrid search](/docs/hybrid) with vectors.

## Advanced tuning

The [BM25 scoring algorithm](https://en.wikipedia.org/wiki/Okapi_BM25) involves three parameters that can be tuned for
your workload:

- `k1` controls how quickly the impact of term frequency saturates. When `k1` is
  close to zero, term frequency is effectively ignored when scoring a document.
  When `k1` is close to infinity, term frequency contributes nearly
  linearly to the score.

  The default value, `1.2`, means that increasing term frequency in a document
  boosts heavily to start but quickly results in diminishing returns.

- `b` controls document length normalization. When `b` is `0.0`, documents are
  treated equally regardless of length, which allows long articles to
  dominate due to sheer volume of terms. When `b` is `1.0`, documents are
  boosted or penalized based on the ratio of their length to the average
  document length in the corpus.

  The default value, `0.75`, controls for length bias without eliminating it
  entirely (long documents are often legitimately more relevant).

- `k3` controls the saturation point for query term frequency. When a query
  contains repeated terms, `k3` determines how much additional weight each
  repetition contributes. When `k3` is close to zero, query term repetition
  is effectively ignored. When `k3` is large, repeated query terms contribute
  nearly linearly to the score.

  The default value, `8.0`, allows repeated query terms to have a meaningful
  impact on scoring while still applying diminishing returns.

The default values are suitable for most applications. Tuning `k1` and `b` is typically
required only if your corpus consists of extremely short texts like tweets
(decrease `k1` and `b`) or extremely long texts like legal documents (increase
`k1` and `b`).

To tune these parameters, we recommend an empirical approach: build a set of
evals, and choose the parameter values that maximize performance on those evals.
