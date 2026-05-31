---
title: "Requirements"
description: "The following are the technical requirements for running turbopuffer in your cloud via BYOC."
group: "Reference"
---

The following are the technical requirements for running turbopuffer in your cloud via BYOC.

## Instance Types

The following are the instance types that turbopuffer uses by default. While CPU counts
can be adjusted within these families, the specific instance type families listed below
are required for optimal performance and compatibility.

### AWS

- m7gd.\{32,48\}xlarge
- m8gd.\{32,48\}xlarge
- i8g.\{32,48\}xlarge
- i7i.\{32,48\}xlarge
- i8ge.\{32,64\}xlarge
- i7ie.\{24,48\}xlarge

### GCP

- c4a-highmem-\{32,48,64\}-lssd
- c4a-standard-\{32,48\}-lssd
- c4-standard-\{32,48\}-lssd
- c4-highmem-\{32,48\}-lssd
- c3-standard-\{44,88\}-lssd

### Azure

 - Standard_L\{32,48\}as_v4
 - Standard_L\{32,48\}s_v4
 - Standard_L\{32,48\}s_v3
 - Standard_L\{32,48\}as_v3
 - Standard_D\{32,48\}pds_v6
 - Standard_D\{32,48\}plds_v6
 - Standard_D\{32,48\}ds_v6
 - Standard_D\{32,48\}lds_v6

## Dedicated Kubernetes Cluster

To guarantee the Service Level Agreements (SLAs) for your turbopuffer cluster, 
the turbopuffer cluster must run on its own dedicated Kubernetes cluster, isolated 
to prevent resource contention and ensure predictable performance. This Kubernetes 
cluster must reside within its own isolated member account in AWS, or its own 
isolated project in GCP.
