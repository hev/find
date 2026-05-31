---
title: "Security & Compliance"
description: "All customer data is hosted exclusively in the region you select. Customer data inserted into one region remains in that region, except when requested"
group: "Operations"
---

## Hosting

All customer data is hosted exclusively in the [region you
select](/docs/regions). Customer data inserted into one region remains in that
region, except when requested by the customer via the turbopuffer API. Customer
data and usage data is always encrypted in transit with TLS1.2+. Customer data
is always encrypted at rest with AES-256, and optionally with a [customer's
key](#customer-managed-encryption-cmek).

## SOC2

turbopuffer undergoes System and Organization Controls (SOC) 2 Type 2 audits of
the design and operational effectiveness of security and availability controls.

You can request a copy of the latest SOC 2 report and Penetration Test
from our [Trust
Center](https://app.drata.com/trust/b4dc7714-f52d-4f50-97e3-ff56a41c2b5c).

## Data Protection (GDPR & CCPA)

turbopuffer provides a [Data Processing Addendum (DPA)](/dpa) for all customers
to enable compliance with the General Data Protection Regulation (GDPR) and the
California Consumer Privacy Act (CCPA).
The DPA describes our commitment to policies that comply with the requirements
of privacy laws on data processors, such as data deletion, breach notification,
and subprocessor management policies.

We're happy to assist with any additional questions you may have as part of your
privacy compliance processes.

## HIPAA

Customers who wish to store protected health information (PHI) in turbopuffer
may request a Business Associate Agreement (BAA) with turbopuffer, under which
turbopuffer commits to compliance with the requirements of HIPAA on business
associates that store and process PHI.

[Contact us](/contact) if you require a BAA or have further questions.

## Vulnerability Disclosure

See our [Vulnerability Disclosure policy](/docs/vdp).

## Customer managed encryption (CMEK)

turbopuffer offers support for [customer managed encryption
keys](/docs/cmek) (CMEK), allowing customers on the [Enterprise](/pricing) plan
to ensure their data is encrypted using keys from their Key Management System
(KMS)/Enterprise Key Manager (EKM).

This _also_ allow customer's customers to use their own KMS to encrypt their
data, as the [encryption key is defined at the namespace level.](/docs/write)

This gives a customer or a customer's customer the same control over their data
as they would have if they were to host their own data in their own bucket.

[Get started with CMEK.](/docs/cmek)

## Private networking

turbopuffer supports private network connections between customer VPCs
and our [multi-tenant regions](/docs/regions). This feature is available to
customers on the [Enterprise](/pricing) plan.

* AWS regions use [AWS PrivateLink](https://aws.amazon.com/privatelink/)
* GCP regions use [GCP Private Service Connect](https://cloud.google.com/vpc/docs/private-service-connect)

[Get started with private networking.](/docs/private-networking)

## Single Sign-On (SSO)

turbopuffer supports Single Sign-On (SSO) for dashboard access on the Scale and Enterprise plans.

[Contact us](/contact) to enable SSO for your organization.

## Privileged access management

turbopuffer only accesses customer data with the customer's written consent. All access is logged, including the accessor, the resources accessed, and the reason. For single-tenant clusters, infrastructure-level controls prevent any turbopuffer employee from accessing customer data or systems without internal approval.

Privileged access management is available as an add-on that gates access behind multi-party approval, enforces time limits on approved sessions, and exposes the audit log to customers. turbopuffer can customize these policies to meet your security requirements. 

[Contact us](/contact) to enable privileged access management.

## Subprocessors for Customer Data

| Subprocessor                  | Purpose of Processing | Subprocessor Country | Data Hosting Location    |
| ----------------------------- | --------------------- | -------------------- | ------------------------ |
| **Google LLC** (GCP)          | Compute and storage   | United States        | Customer-selected region |
| **Amazon Web Services** (AWS) | Compute and storage   | United States        | Customer-selected region |

Subscribe to subprocessor update notifications for when we engage new customer data subprocessors.
