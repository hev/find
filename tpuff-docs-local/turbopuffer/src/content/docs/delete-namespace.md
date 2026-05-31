---
title: "Delete namespace"
description: "DELETE /v2/namespaces/:namespace"
group: "API"
---

DELETE /v2/namespaces/:namespace

Delete a namespace.

Deletes the namespace and all its documents entirely. There is no way to recover a deleted namespace.

After the delete operation returns `HTTP 200`, you can reuse the same namespace name by writing to it again.

## Examples

<!-- multilang -->
```bash
curl https://gcp-us-central1.turbopuffer.com/v2/namespaces/delete-namespace-example-curl \
  -X DELETE --fail-with-body \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY"

# Response payload
# {
#   "status": "ok"
# }
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace(f'delete-namespace-example-py')
# If an error occurs, this call raises a turbopuffer.APIError if a retry was not successful.
ns.delete_all()
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

const ns = tpuf.namespace(`delete-namespace-example-ts`);

await ns.deleteAll();
```
```go
package main

import (
	"context"
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

	ns := tpuf.Namespace("delete-namespace-example-go")

	_, err = ns.DeleteAll(ctx, turbopuffer.NamespaceDeleteAllParams{})
	if err != nil {
		// Returns an error if the deletion is not successful even after
		// retries.
		panic(err)
	}
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;

public class DeleteNamespace {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();

    var ns = tpuf.namespace("delete-namespace-example-java");

    // If an error occurs, this call raises a TurbopufferServiceException if
    // a retry was not successful.
    ns.deleteAll();
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

var ns = tpuf.Namespace("delete-namespace-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));

// If an error occurs, this call raises a TurbopufferApiException if
// a retry was not successful.
await ns.DeleteAll(new NamespaceDeleteAllParams());
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("delete-namespace-example-rb")
# If an error occurs, this call raises a Turbopuffer::Errors::APIError if a retry was not successful.
ns.delete_all
```
<!-- /multilang -->
