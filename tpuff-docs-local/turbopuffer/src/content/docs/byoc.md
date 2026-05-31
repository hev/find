---
title: "turbopuffer BYOC"
description: "Deploy turbopuffer into your Kubernetes cluster on AWS, GCP, or Azure with turbopuffer BYOC (Bring Your Own Cloud)."
group: "Operations"
---

Deploy turbopuffer into your Kubernetes cluster on AWS, GCP, or Azure with
turbopuffer BYOC (Bring Your Own Cloud).

The turbopuffer team is on-call for your cluster, and help you operate it
through our secure control plane without direct access to your VPC. Handle
billions of vectors without worrying about operations.

```
┌─Customer Account───────────────────────────┐       ┌─turbopuffer Account───┐
│                                            │       │                       │
│┌──turbopuffer sub-account─────────────────┐│       │ ┌───────────────────┐ │
││                                          ││       │ │     Telemetry     │ │
││              ┌──Kubernetes──────────────┐││       │ └───────────────────┘ │
││ ┌─────────┐  │ ┌─────────┐  ┌─────────┐ │││       │ ┌───────────────────┐ │
││ │ Bucket  │  │ │ Compute │  │ Control │ │││       │ │       Usage       │ │
││ │  (AES)  │──┼─│         │  │  Plane  ├─┼┼──TLS──▶│ └───────────────────┘ │
││ └─────────┘  │ └─────▲───┘  └─────────┘ │││       │ ┌───────────────────┐ │
││              └───────┼──────────────────┘││       │ │     Dashboard     │ │
│└──────────────────────┼───────────────────┘│       │ └───────────────────┘ │
│                       │                    │       │ ┌───────────────────┐ │
│                       │                    │       │ │   Control Plane   │ │
│┌──Customer sub-account┴───────────────────┐│       │ └───────────────────┘ │
││ ┌──────┐   ┌──────┐   ┌──────┐           ││       │ ┌───────────────────┐ │
││ │App 1 │   │App 2 │   │App 3 │           ││       │ │ Container Images  │ │
││ └──────┘   └──────┘   └──────┘           ││       │ └───────────────────┘ │
│└──────────────────────────────────────────┘│       └───────────────────────┘
└────────────────────────────────────────────┘
```

## Security

* Data is encrypted in transit with TLS1.2+, 
* Data is encrypted at rest with AES-256 in Google Cloud Storage, Amazon S3, or Azure Blob Storage.
* Data is cached in memory and on NVMe SSD disks. SSD cache is encrypted with AES-256.
  * In AWS, SSD cache is implemented with instance stores, and the encryption key is ephemeral and destroyed when the VM shuts down.
* No customer data leaves the customer's VPC
* turbopuffer does not have access to the customer's VPC

See more details in the [Security](/docs/security) page.

## Setup

Customer receives an "BYOC kit" that holds Terraform and Kubernetes
configuration files and provisions the VPC and Kubernetes cluster. See
[Deployment](/docs/byoc/deployment). You can get a sense of the Terraform and
Kubernetes configuration files with this [scrubbed
example](https://gist.github.com/xldenis/46ce17c286ec64fe8a8e434c21b9132e).

## Control Plane

The control plane has two components:

1. **Customer Component** runs inside the customer's cluster and executes
   operations. The customer can approve each audit logged operation. The
   customer component is source-available by request.
2. **Vendor Component** runs inside turbopuffer's VPC and allows the turbopuffer
   team to propose operations.

The types of operations the control plane can perform are:

* Upgrades of turbopuffer or the Kubernetes configuration
* Change turbopuffer configuration (cache sizes, tuning, recall)
* Trigger manual tasks (compaction, rebuild indexes, GC, consistency checks,
cache flush)
* Trigger horizontal or vertical scaling
* Exposing additional debugging information (e.g. copy of metadata file without
customer data from object storage)

The control plane is not required for the data plane to operate, i.e.
turbopuffer can accept writes and queries if the control plane is down.

## Operation Approval Model & SLAs

turbopuffer will provide support under the terms of the Service Level Agreement
in your Master Subscription Agreement (MSA). The turbopuffer team is on-call for
your cluster.

The turbopuffer team does not require access to your VPC. All operations are
performed securely through the control plane with audit logs. You can choose two
models for accepting operations:

**Secure Operations (Push Model).** The turbopuffer on-call is allowed to
execute audit logged operations through the control plane at any time. This
means we can uphold higher SLAs as we don't require working with your oncall.

**Human Approved Operations (Pull Model).** All operations must go through
manual approval from the customer. The turbopuffer team requires access to the
customer's on-call responsible for the turbopuffer cluster to grant access
within SLAs. This access model affects pricing and the SLAs we can provide.

Operations are implemented as Kubernetes Custom Resource Definitions (CRDs).
This allows you to use your existing tools to manage audit logs of cluster
operations.

## Upgrades

turbopuffer can be upgraded, scaled up, or scaled down without downtime by the
control plane. Any node can accept traffic for any namespace at any time.
Therefore, zero downtime upgrades can be performed with a simple rolling
restart.

Container images can optionally be replicated into the customer sub-account.
This allows the customer to enable extra security features such as enabling
image tag immutability. All images are signed by `cosign` and can be verified by
the customer.

## Network Isolation

turbopuffer does not require any external incoming connections through the
firewall. The customer can choose to disable all incoming connections, and
access turbopuffer through their private VPC networking.

turbopuffer does require outgoing connections for telemetry, usage data, and to
receive commands from the control plane. By default, these connections are
routed over the Internet. The external IPs can be allowlisted, see
[Deployment](/docs/byoc/deployment#networking).

## Telemetry

Telemetry is emitted to Datadog (traces, metrics, and logs) and
[Polar Signals](https://www.polarsignals.com/) (CPU and heap profiling) directly
from the customer's account for turbopuffer to monitor. No customer data is ever
emitted in the telemetry. This allows continous monitoring by the turbopuffer
team. Telemetry includes:

- performance and infrastructure health metrics (no customer data)
- request logs and error logs (no customer data)
- performance tracing data (no customer data)
- CPU and heap profiling (no customer data)

The customer has access to a shared Datadog dashboard with Telemetry.

## Usage & Dashboard

Aggregated usage metrics are reported to the turbopuffer usage database. These
metrics are used for billing, and are displayed on the turbopuffer dashboard.

## Compliance

turbopuffer maintains System and Organization Controls (SOC) 2 Type 2
compliance, with continuous auditing by an AICPA certified auditor. To receive
a copy of our latest report, please contact us. For healthcare customers,
turbopuffer can also provide a HIPAA compliant BAA.
