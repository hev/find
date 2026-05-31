---
title: "List namespaces"
description: "GET /v1/namespaces"
group: "API"
---

GET /v1/namespaces

Paginate through your namespaces.

Paginate through the list of namespaces, optionally with a given prefix. You can retrieve more information about a specific namespace with the [metadata endpoint](/docs/metadata).

This endpoint is available to API keys with read-only, read/write, or admin permissions.

## Request

**cursor** string
optional

retrieve the next page of results (pass `next_cursor` from the response payload)

---

**prefix** string
optional

retrieve only namespaces that match the prefix, e.g. `foo` would return `foo` and `foo-bar`.

---

**page_size** string
default: 100

limit the number of results per page (max of 1000)

## Response

**namespaces** array

An array of namespace objects. Each namespace object contains:

* `id` (string): the namespace identifier

**Example:**

```json
[
  {"id": "my-namespace"},
  {"id": "test-namespace"},
  {"id": "production-data"}
]
```

**next_cursor** string

A cursor for pagination. Pass this value as the `cursor` parameter in the next request to retrieve the next page of results. Only present when there are more namespaces to retrieve.

## Examples

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v1/namespaces?page_size=50 \
  --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY"

# Response payload
# {
#   "namespaces": [
#     {
#       "id": "03b0fdf8-b1ae-11ee-a548-b121c8275f7a-client_test",
#     },
#     {
#       "id": "03b0fdf8-b1ae-11ee-a548-b121c8275f7a-hello_world",
#     },
#   ]
#   "next_cursor": "MDk0ZGY4NjYtYjM1Yi0xMWVlLWI5YzYtMWRiM2IyMzRkNWEzLWhlbGxvX3dvcmxk"
# }
#
# Unlike with the SDKs, you'll need to paginate through the results manually
# using `next_cursor`.
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

# List all namespaces
namespaces = tpuf.namespaces()
for namespace in namespaces:
    print('Namespace', namespace.id)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

for await (const namespace of tpuf.namespaces()) {
  console.log("Namespace", namespace.id);
}
```
```go
package main

import (
	"context"
	"fmt"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	ctx := context.Background()
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-central1"),
	)

	namespaces := tpuf.NamespacesAutoPaging(ctx, turbopuffer.NamespacesParams{})
	for namespaces.Next() {
		fmt.Println("Namespace:", namespaces.Current().ID)
	}
	if err := namespaces.Err(); err != nil {
		panic(err.Error())
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;

public class Namespaces {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var namespaces = tpuf.namespaces();
    for (var namespace : namespaces.autoPager()) {
      System.out.println("Namespace: " + namespace.id());
    }
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using Turbopuffer;

using var tpuf = new TurbopufferClient
{
    // Pick the right region: https://turbopuffer.com/docs/regions
    Region = "gcp-us-central1",
};

var namespaces = await tpuf.Namespaces();
await foreach (var ns in namespaces.Paginate())
{
    Console.WriteLine($"Namespace: {ns.ID}");
}
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

# List all namespaces
tpuf.namespaces.auto_paging_each do |namespace|
  puts "Namespace #{namespace.id}"
end
```
<!-- /multilang -->
