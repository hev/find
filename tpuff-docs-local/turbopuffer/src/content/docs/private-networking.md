---
title: "Private Networking"
description: "turbopuffer supports private network connections between your VPC and our multi-tenant regions."
group: "Operations"
---

```
    ┌─────your VPC───────────────┐                  ┌─────tpuf VPC───────────────┐
    │                            │░                 │                            │░
    │ ┌─────────┐ ┌─────────┐    │░                 │    ┌─────────┐ ┌─────────┐ │░
    │ │ client  │ │ client  │ ◀──┼──────────────────┼──▶ │ storage │ │ compute │ │░
    │ └─────────┘ └─────────┘    │░  PrivateLink/   │    └─────────┘ └─────────┘ │░
    │                            │░      PSC        │                            │░
    └────────────────────────────┘░                 └────────────────────────────┘░
     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

turbopuffer supports private network connections between your VPC
and our [multi-tenant regions](/docs/regions).

* AWS regions use [AWS PrivateLink](https://aws.amazon.com/privatelink/)
* GCP regions use [GCP Private Service Connect](https://cloud.google.com/vpc/docs/private-service-connect)

Private network connection across cloud providers (e.g. AWS => GCP) are
not supported. [Contact us](/contact/support) if you need this.

## Enforcement

By default, even after establishing a private network connection to a region,
API requests for your organization will still be permitted via the public
endpoint for the region.

Upon request, turbopuffer can enforce that all API requests for an organization
are made via your private endpoints.

## Pricing

* Private networking is only available on the [enterprise plan](/pricing).
* There are no usage-based fees for private network endpoints.

## Setup

1. [ ] Provide [turbopuffer support](/contact/support) with:
   - [ ] Your AWS account ID or your GCP project ID
   - [ ] The [region](/docs/regions) you want to establish a private connections to
2. [ ] Wait for turbopuffer to authorize connections from your cloud account
3. [ ] Establish a private network connection to the service name provided by turbopuffer support
    - **AWS:** [Create an interface VPC endpoint](https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html)
    - **GCP:** [Create a Private Service Connect endpoint](https://cloud.google.com/vpc/docs/create-manage-private-service-connect-interfaces)

4. [ ] Set the `base_url` in your client to the private endpoint for your region (see table below)

| Region | Private Endpoint |
| --- | --- |
| aws-ap-southeast-2 | https://privatelink.aws-ap-southeast-2.turbopuffer.com |
| aws-ca-central-1 | https://privatelink.aws-ca-central-1.turbopuffer.com |
| aws-eu-central-1 | https://privatelink.aws-eu-central-1.turbopuffer.com |
| aws-eu-west-1 | https://privatelink.aws-eu-west-1.turbopuffer.com |
| aws-eu-west-2 | https://privatelink.aws-eu-west-2.turbopuffer.com |
| aws-us-east-1 | https://privatelink.aws-us-east-1.turbopuffer.com |
| aws-us-east-2 | https://privatelink.aws-us-east-2.turbopuffer.com |
| aws-us-west-2 | https://privatelink.aws-us-west-2.turbopuffer.com |
| aws-ap-south-1 | https://privatelink.aws-ap-south-1.turbopuffer.com |
| aws-sa-east-1 | https://privatelink.aws-sa-east-1.turbopuffer.com |
| gcp-us-central1 | https://<endpoint name>.psc.gcp-us-central1.turbopuffer.com |
| gcp-us-east1 | https://<endpoint name>.psc.gcp-us-east1.turbopuffer.com |
| gcp-us-west1 | https://<endpoint name>.psc.gcp-us-west1.turbopuffer.com |
| gcp-us-east4 | https://<endpoint name>.psc.gcp-us-east4.turbopuffer.com |
| gcp-northamerica-northeast2 | https://<endpoint name>.psc.gcp-northamerica-northeast2.turbopuffer.com |
| gcp-europe-west3 | https://<endpoint name>.psc.gcp-europe-west3.turbopuffer.com |
| gcp-europe-west1 | https://<endpoint name>.psc.gcp-europe-west1.turbopuffer.com |
| gcp-asia-southeast1 | https://<endpoint name>.psc.gcp-asia-southeast1.turbopuffer.com |
| gcp-asia-northeast3 | https://<endpoint name>.psc.gcp-asia-northeast3.turbopuffer.com |
