---
title: "Regions"
description: "turbopuffer supports multiple regions, choose the one closest to your backend."
group: "Concepts"
---

turbopuffer supports multiple regions, choose the one closest to your backend.

| Region | URL | Location |
| --- | --- | --- |
| aws-ap-southeast-2 | https://aws-ap-southeast-2.turbopuffer.com | Sydney |
| aws-ca-central-1 | https://aws-ca-central-1.turbopuffer.com | Montreal |
| aws-eu-central-1 | https://aws-eu-central-1.turbopuffer.com | Frankfurt |
| aws-eu-west-1 | https://aws-eu-west-1.turbopuffer.com | Ireland |
| aws-eu-west-2 | https://aws-eu-west-2.turbopuffer.com | London |
| aws-us-east-1 | https://aws-us-east-1.turbopuffer.com | N. Virginia |
| aws-us-east-2 | https://aws-us-east-2.turbopuffer.com | Ohio |
| aws-us-west-2 | https://aws-us-west-2.turbopuffer.com | Oregon |
| aws-ap-south-1 | https://aws-ap-south-1.turbopuffer.com | Mumbai |
| aws-sa-east-1 | https://aws-sa-east-1.turbopuffer.com | São Paulo |
| gcp-us-central1 | https://gcp-us-central1.turbopuffer.com | Iowa |
| gcp-us-east1 | https://gcp-us-east1.turbopuffer.com | South Carolina |
| gcp-us-west1 | https://gcp-us-west1.turbopuffer.com | Oregon |
| gcp-us-east4 | https://gcp-us-east4.turbopuffer.com | N. Virginia |
| gcp-northamerica-northeast2 | https://gcp-northamerica-northeast2.turbopuffer.com | Toronto |
| gcp-europe-west3 | https://gcp-europe-west3.turbopuffer.com | Frankfurt |
| gcp-europe-west1 | https://gcp-europe-west1.turbopuffer.com | Belgium |
| gcp-asia-southeast1 | https://gcp-asia-southeast1.turbopuffer.com | Singapore |
| gcp-asia-northeast3 | https://gcp-asia-northeast3.turbopuffer.com | Seoul |

We support Azure for "Deploy in your VPC", but no public regions yet. [Contact us](/contact) if you need a public Azure region.

In addition to these public clusters, we run dedicated clusters in various other
regions for single-tenancy customers and in any region inside your VPC in AWS,
GCP and Azure (BYOC). We can spin up dedicated or BYOC clusters in hours upon request, [contact
us](/contact). We will continue to expand public regions with
demand.

<!-- multilang -->
```bash
# Pick the right region: https://turbopuffer.com/docs/regions
REGION_URL="https://gcp-us-east4.turbopuffer.com"

# First, create a namespace and add some data
curl --fail-with-body -X POST "$REGION_URL/v2/namespaces/region-example-curl" \
  -H "Authorization: Bearer $TURBOPUFFER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "upsert_rows": [
      {"id": 1, "vector": [0.1, 0.2, 0.3]},
      {"id": 2, "vector": [0.4, 0.5, 0.6]}
    ],
    "distance_metric": "cosine_distance"
  }'
```
```python
import turbopuffer

tpuf = turbopuffer.Turbopuffer(
    # Pick the right region: https://turbopuffer.com/docs/regions
    region='gcp-us-east4',
)

ns = tpuf.namespace(f'region-example-py')
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

const tpuf = new Turbopuffer({
  // Pick the right region: https://turbopuffer.com/docs/regions
  region: "gcp-us-east4",
});

const ns = tpuf.namespace(`region-example-ts`);
```
```go
package main

import (
	"fmt"
	"os"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

func main() {
	tpuf := turbopuffer.NewClient(
		// Pick the right region: https://turbopuffer.com/docs/regions
		option.WithRegion("gcp-us-east4"),
	)

	ns := tpuf.Namespace("region-example-go")

	// Use the namespace to avoid "declared and not used" error
	fmt.Printf("Created namespace in region: %v\n", ns)
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;
import java.util.stream.*;

public class Region {

  public static void main(String[] args) {
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-east4")
      .build();

    var ns = tpuf.namespace("region-example-java");
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
    Region = "gcp-us-east4",
};

var ns = tpuf.Namespace("region-example-csharp-" + Environment.GetEnvironmentVariable("NONCE"));
```
```ruby
require "turbopuffer"

tpuf = Turbopuffer::Client.new(
  region: "gcp-us-central4", # pick the right region: https://turbopuffer.com/docs/regions
)

ns = tpuf.namespace("region-example-rb")
```
<!-- /multilang -->

To move data between regions, use [`copy_from_namespace`](/docs/write#param-copy_from_namespace) with a cross-region source. For granular control, use the [export](/docs/export) and [write](/docs/write) APIs with a client for each region.

## Cross-Cloud Latency

Since response times for vector search are typically above 10ms, the
contribution of cross-cloud latency is generally acceptable. Traffic within a
cloud provider's region is lower latency (\< 1ms) than cross-cloud traffic
(1-10ms), even if the providers are geographically close. For larger
customers, cross-cloud interconnects can be set up to reduce network latency.

## Cross-Cloud Egress Fees

A common misconception is that as long as your vendor is in the same Cloud as
you (e.g. AWS ↔️ AWS), you will be charged lower networking fees. This is generally not the case,
as most providers' API endpoints point to public IPs that route through the
public internet, unless you've set up a private connect (see below; you'll know if you
have). Any traffic leaving your VPC incurs \$0.05-0.09/GB Internet egress fees
([AWS](https://aws.amazon.com/ec2/pricing/on-demand/) /
[GCP](https://cloud.google.com/vpc/network-pricing#all-networking-pricing)/
[Azure](https://azure.microsoft.com/en-us/pricing/details/bandwidth/)).

Egress networking fees are charged to you on your bill by your provider. For
larger customers, we will work with you to set up AWS Private Link, GCP Private
Service Connect, Azure Private Link or an interconnect to reduce networking fees
to \$0.01/GB. Unless you're transferring tens of billions of vectors per month,
this is unlikely to have a large effect on your bill (1B vectors = 6TB would be
\$600 of egress, not a significant issue).
