---
title: "Export documents"
description: "Export documents"
group: "API"
---

Export documents

To export all documents in a namespace, use the [query](/docs/query) API to page
through documents by advancing a filter on the `id` attribute.

Documents inserted while the export is in progress will be included.

A common use-case for this is to copy your all documents to a different
namespace after some client-side transformation. To copy documents without
transformation, use [copy_from_namespace](/docs/write#param-copy_from_namespace)
for a more efficient server-side copy (follow with
[delete_by_filter](/docs/write/#param-delete_by_filter) to copy only a subset of
documents).

<!-- multilang -->
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'export-example-py')

last_id = None
while True:
    result = ns.query(
        rank_by=('id', 'asc'),
        limit=10_000,
        filters=('id', 'Gt', last_id) if last_id is not None else turbopuffer.omit,
    )

    # Do something with the page of results.
    print(result)

    if len(result.rows) < 10_000:
        break
    last_id = result.rows[-1].id
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`export-example-ts`);

let lastId: string | number | null = null;
while (true) {
  const result = await ns.query({
    rank_by: ["id", "asc"],
    limit: 10_000,
    filters: lastId !== null ? ["id", "Gt", lastId] : undefined,
  });

  // Do something with the page of results.
  console.log(result.rows);

  if (result.rows!.length < 10_000) break;
  lastId = result.rows![result.rows!.length - 1].id;
}
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

	ns := tpuf.Namespace("export-example-go")

	var lastID any
	for {
		var filters turbopuffer.Filter
		if lastID != nil {
			filters = turbopuffer.NewFilterGt("id", lastID)
		}

		result, err := ns.Query(
			ctx,
			turbopuffer.NamespaceQueryParams{
				RankBy:  turbopuffer.NewRankByAttribute("id", turbopuffer.RankByAttributeOrderAsc),
				Limit: turbopuffer.LimitParam{
					Total: 10_000,
				},
				Filters: filters,
			},
		)
		if err != nil {
			panic(err)
		}

		// Do something with the page of results.
		fmt.Print(turbopuffer.PrettyPrint(result.Rows))

		if len(result.Rows) < 10_000 {
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

public class Export {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("export-example-java");

    JsonValue lastId = null;
    while (true) {
      var queryParams = NamespaceQueryParams.builder()
        .rankBy(RankBy.attribute("id", RankByAttributeOrder.ASC))
        .limit(10_000);
      if (lastId != null) {
        queryParams = queryParams.filters(Filter.gt("id", lastId));
      }
      var result = ns.query(queryParams.build());
      var rows = result.rows().get();

      // Do something with the page of results.
      System.out.println(rows);

      if (rows.size() < 10_000) {
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
using System.Text.Json;
using Turbopuffer;
using Turbopuffer.Models.Namespaces;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var ns = tpuf.Namespace("export-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

JsonElement? lastId = null;
while (true)
{
    var queryParams = new NamespaceQueryParams
    {
        RankBy = RankBy.Attribute("id", RankByAttributeOrder.ASC),
        Limit = 10_000,
    };
    if (lastId != null)
    {
        queryParams = queryParams with { Filters = Filter.Gt("id", lastId) };
    }
    var result = await ns.Query(queryParams);
    var rows = result.GetRows();

    // Do something with the page of results.
    foreach (var row in rows)
    {
        Console.WriteLine(row);
    }

    if (rows.Count < 10_000)
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

ns = tpuf.namespace("export-example-rb")

last_id = nil
loop do
  filters = last_id ? ["id", "Gt", last_id] : nil
  result = ns.query(
    rank_by: ["id", "asc"],
    limit: 10_000,
    filters: filters,
  )

  # Do something with the page of results.
  puts result.rows

  break if result.rows.length < 10_000
  last_id = result.rows.last.id
end
```
<!-- /multilang -->
