---
title: "Setting up CMEK encryption with an EKM"
description: "By default, all data at rest is encrypted using AES-256 using the cloud provider's managed keys."
group: "Operations"
---

```
                   ┌─────tpuf bucket────────────┐                                      
                   │  ┌────────────────────┐    │░                                     
                   │  │    namespace a     │    │░           ┌───your cloud───────────┐
──────write────────┼─▶│  (AES-256, Cloud   │    │░           │ ┌──EKM-A─────────────┐ │
                   │  │    managed key)    │    │░           │ │ ╔══════╗  ┌──────┐ │ │
                   │  └────────────────────┘    │░    ┌──────┼─┼▶║key-1 ║  │key-2 │ │ │
      write        │  ┌────────────────────┐    │░    │      │ │ ╚══════╝  └──────┘ │ │
──/EKM-A/key-1─────┼─▶│    namespace b     │    │░    │      │ └────────────────────┘ │
                   │  │(AES-256, Your Key) │◀───┼─────┘      └────────────────────────┘
                   │  │                    │    │░                                     
                   │  └────────────────────┘    │░           ┌───your customer's cloud┐
                   │  ┌────────────────────┐    │░           │ ┌─EKM-B──────────────┐ │
      write        │  │    namespace C     │    │░           │ │ ╔══════╗  ┌──────┐ │ │
──/EKM-B/key-3─────┼─▶│   (AES-256, Your   │◀───┼────────────┼─┼▶║key-3 ║  │key-4 │ │ │
                   │  │  Customer's Key)   │    │░           │ │ ╚══════╝  └──────┘ │ │
                   │  └────────────────────┘    │░           │ └────────────────────┘ │
                   └────────────────────────────┘░           └────────────────────────┘
                    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

By default, all data at rest is encrypted using AES-256 using the cloud
provider's managed keys.

turbopuffer supports [customer managed encryption keys](/docs/write#param-encryption)
(CMEK) for [enterprise](/pricing) customers. CMEK encryption allows customer and
customer's customer the similar control of their data as if it was in their own
bucket. CMEK can often be used in place of self-hosting with simpler
operational requirements.

When using CMEK, writes provide a key name (GCP resource ID or AWS ARN)
identifying an encryption key in the customer's key management system (customer
KMS) also known as External Key Manager (EKM). All namespace objects will then
be encrypted with this customer provided key, which can be revoked at any time.

## Enabling CMEK

1. Ensure you are on the [enterprise](/pricing) plan.

2. Open your cloud Provider's Console and create a KMS/EKM in the same region as
the turbopuffer region(s) you're using.

3. Ask turbopuffer support to get the turbopuffer Service Account email (GCP) or
account ARN (AWS).

4. Grant turbopuffer access to the key:
  - On GCP, edit the *Key Ring* and grant the Permission `Cloud KMS CryptoKey
    Encrypter/Decrypter` to the turbopuffer service account email.
  - On AWS, edit the *Key Policy* to add the following statement:
  ```json
    {
      "Sid": "KeyUsage",
      "Effect": "Allow",
      "Principal": {
        "AWS": "<provided by turbopuffer>"
      },
      "Action": [
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:Encrypt",
        "kms:DescribeKey",
        "kms:Decrypt"
      ],
      "Resource": "*"
    }
  ```

5. Use the key name to [write](/docs/write#param-encryption) to your turbopuffer
namespace.

## When do I provide the encryption key?

The encryption key name only needs to be provided on
[writes](/docs/write#param-encryption). All future writes will use the
previously sent encryption key name, which cannot be changed after the first upsert.
Queries do not need to provide the encryption key name; the underlying object store
will transparently decrypt objects so long as turbopuffer maintains
permission to use your keys.

## Does CMEK impact latency or availability?

No, CMEK does not impact either availability or performance of turbopuffer.

## What does it cost?

On the turbopuffer side, there is no additional cost to using CMEK on top of your plan.

Your cloud provider will charge you based on the number of encryption operations and the number of keys.

## Who is doing the encryption?

Encryption of the data at rest is handled entirely by the cloud object store.

* AWS S3 - data is stored with [Server-Side Encryption using AWS KMS-managed keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html)
* Google Cloud Storage - data is stored with GCS's [CMEK](https://cloud.google.com/storage/docs/encryption/customer-managed-keys).

## How quickly does key revocation take effect?

Key revocation is subject to a small propagation delay governed by the
underlying cloud provider:

  * On AWS, key revocation typically propagates in a few seconds, but in
    some cases can take several minutes ([docs](https://docs.aws.amazon.com/kms/latest/developerguide/grants.html#terms-eventual-consistency)).

  * On GCP, key revocation typically propagates within one minute, but in
    exceptional cases can take several hours ([docs](https://docs.cloud.google.com/kms/docs/consistency)).

## Does turbopuffer support key rotation?

When you rotate your cloud KMS key, turbopuffer will automatically use the
latest active key version for new writes. However, turbopuffer does not
automatically re-encrypt existing data. This means:

- Data written before rotation remains encrypted with the previous key version
- New data will be encrypted with the latest key version
- You must keep all previously used key versions active to maintain access to
  older data
- Revoking previous key versions will make that namespace permanently inaccessible

If you need to migrate all data to a new key version, you have two options:

1. Use the [export](/docs/export) API to re-upsert your data into a new namespace with the desired encryption configuration
2. Use [`copy_from_namespace`](/docs/write#param-copy_from_namespace) with a different `encryption` parameter to copy the namespace with a new CMEK key

The second option is faster and more cost-effective, with up to a 75% write discount. It also works for upgrading an namespace from default to CMEK encryption, or for downgrading from CMEK to default encryption by setting [`encryption`](/docs/write#param-encryption) to `{"mode": "default"}`.

## How is a branched namespace encrypted?

A branch inherits the encryption configuration of its source namespace. To
re-encrypt with a different CMEK key, use
[`copy_from_namespace`](/docs/write#param-copy_from_namespace) instead.

**Should you find this limiting, [contact us](/contact)**
