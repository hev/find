---
title: "Cross-Region Backups"
description: "turbopuffer supports efficient namespace copies across regions via copyfromnamespace for geo-redundancy, disaster recovery, and accidental deletion pr"
group: "Operations"
---

```
  ┌─aws-us-east-1 (source)─────┐              ┌─aws-us-west-2 (dest)───┐
  │                            │░             │                        │░
  │  ┌──────────────────────┐  │░             │  ┌──────────────────┐  │░
  │  │    my-namespace      │  │░ ──────────▶ │  │ my-namespace-copy│  │░
  │  └──────────────────────┘  │░             │  └──────────────────┘  │░
  │                            │░             │            ▲           │░
  └────────────────────────────┘░             └────────────┼───────────┘░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              ░░░░░░░░░░░░│░░░░░░░░░░░░░
                                                           │
                                     ──copy_from_namespace─┘
```

turbopuffer supports efficient namespace copies across [regions](/docs/regions) via
[copy_from_namespace](/docs/write#param-copy_from_namespace) for geo-redundancy,
disaster recovery, and accidental deletion protection. We don't currently offer automated backups. Historically,
customers have rebuilt from their primary data source when needed, but
cross-region copies are now often a better option.

[Branching](/docs/branching) provides constant-time namespace snapshots, but
shares underlying storage with the source namespace. Use `copy_from_namespace`
for full data isolation.

Copies are performed entirely server-side, so there's no data transfer through
your infrastructure. They're billed at up to a 75% write discount and create fully
writable namespaces you can use however you like. Cross-region copies also bill
returned bytes for the logical size copied. Storage is billed at standard rates,
but since you're not querying backup namespaces, they're cheap to keep around,
making daily or weekly snapshots practical. Copies work across regions and
across cloud providers (e.g., AWS to GCP).

## CMEK encryption

To encrypt the backup with a [customer managed encryption key (CMEK)](/docs/cmek), specify an
encryption key in the [`encryption` parameter](/docs/write#param-encryption).
The key must be available in the destination region.

Specifying an encryption key is mandatory if the source namespace has CMEK
encryption enabled.

## Running Backups on Schedule

To maintain up-to-date backups, run cross-region copies on a regular schedule.
Here's an example script (run via cron or any scheduler) that backs up all
namespaces matching a prefix. It appends the date to each backup namespace name
and automatically cleans up backups older than 7 days:

<!-- multilang -->
```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["turbopuffer"]
# ///

import os
import time

import turbopuffer

# Configuration
SOURCE_REGION = "gcp-us-central1"
BACKUP_REGION = "gcp-us-west1"
SOURCE_PREFIX = "fts-"  # Back up all namespaces starting with "fts-"
BACKUP_PREFIX = "backup-"  # Backup namespaces will be "backup-{name}-{date}"
RETENTION_DAYS = 7

source_client = turbopuffer.Turbopuffer(
    api_key=os.getenv("TURBOPUFFER_API_KEY"), region=SOURCE_REGION
)
backup_client = turbopuffer.Turbopuffer(
    api_key=os.getenv("TURBOPUFFER_API_KEY"), region=BACKUP_REGION
)

timestamp = int(time.time())  # Unix epoch seconds
start_time = time.time()

# Step 1: Back up each namespace matching the source prefix
print("Starting backups...")
namespaces = list(source_client.namespaces(prefix=SOURCE_PREFIX))

for ns in namespaces:
    backup_name = f"{BACKUP_PREFIX}{ns.id}-{timestamp:010d}"
    print(f"  Backing up: {ns.id}")
    backup_ns = backup_client.namespace(backup_name)

    backup_ns.copy_from(
        source_namespace=ns.id,
        source_region=SOURCE_REGION,
        # if backing up to a different organization, include source_api_key:
        # source_api_key="<source-org-api-key>",
    )

# Step 2: Delete old backups beyond the retention period (after successful backup)
print("Cleaning up old backups...")
cutoff = int(time.time()) - RETENTION_DAYS * 86400
deleted = 0

for ns in backup_client.namespaces(prefix=BACKUP_PREFIX):
    # Safety check: only delete namespaces that match our backup prefix
    assert len(BACKUP_PREFIX) > 0 and ns.id.startswith(
        BACKUP_PREFIX
    ), f"Refusing to delete namespace that doesn't match backup prefix: {ns.id}"

    # Extract timestamp from backup namespace name (e.g., "backup-prod-users-1234567890")
    if len(ns.id) >= 10:
        try:
            backup_time = int(ns.id[-10:])
            if backup_time < cutoff:
                print(f"  Deleting: {ns.id}")
                backup_client.namespace(ns.id).delete_all()
                deleted += 1
        except ValueError:
            print(
                f"  Skipping {ns.id}: invalid timestamp format",
                file=__import__("sys").stderr,
            )

print(
    f"Done: backed up {len(namespaces)} namespaces, deleted {deleted} old backups in {time.time() - start_time:.1f}s"
)
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

// Configuration
const SOURCE_REGION = "gcp-us-central1";
const BACKUP_REGION = "gcp-us-west1";
const SOURCE_PREFIX = "fts-"; // Back up all namespaces starting with "fts-"
const BACKUP_PREFIX = "backup-"; // Backup namespaces will be "backup-{name}-{date}"
const RETENTION_DAYS = 7;

const sourceClient = new Turbopuffer({ region: SOURCE_REGION });
const backupClient = new Turbopuffer({ region: BACKUP_REGION });

const timestamp = Math.floor(Date.now() / 1000); // Unix epoch seconds
const startTime = Date.now();

// Step 1: Back up each namespace matching the source prefix
console.log("Starting backups...");
const namespaces: string[] = [];

for await (const ns of sourceClient.namespaces({ prefix: SOURCE_PREFIX })) {
  namespaces.push(ns.id);
  const backupName = `${BACKUP_PREFIX}${ns.id}-${String(timestamp).padStart(10, "0")}`;
  console.log(`  Backing up: ${ns.id}`);

  const backupNs = backupClient.namespace(backupName);
  await backupNs.copyFrom({
    source_namespace: ns.id,
    source_region: SOURCE_REGION,
    // if backing up to a different organization, include source_api_key:
    // source_api_key: "<source-org-api-key>",
  });
}

// Step 2: Delete old backups beyond the retention period (after successful backup)
console.log("Cleaning up old backups...");
const cutoff = Math.floor(Date.now() / 1000) - RETENTION_DAYS * 86400;
let deleted = 0;

for await (const ns of backupClient.namespaces({ prefix: BACKUP_PREFIX })) {
  // Safety check: only delete namespaces that match our backup prefix
  if (BACKUP_PREFIX.length === 0 || !ns.id.startsWith(BACKUP_PREFIX)) {
    throw new Error(`Refusing to delete namespace that doesn't match backup prefix: ${ns.id}`);
  }

  // Extract timestamp from backup namespace name (e.g., "backup-prod-users-1234567890")
  if (ns.id.length >= 10) {
    const backupTime = parseInt(ns.id.slice(-10), 10);
    if (!isNaN(backupTime) && backupTime < cutoff) {
      console.log(`  Deleting: ${ns.id}`);
      await backupClient.namespace(ns.id).deleteAll();
      deleted++;
    }
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(
  `Done: backed up ${namespaces.length} namespaces, deleted ${deleted} old backups in ${elapsed}s`
);
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

// Configuration
const (
	SourceRegion  = "gcp-us-central1"
	BackupRegion  = "gcp-us-west1"
	SourcePrefix  = "fts-"    // Back up all namespaces starting with "fts-"
	BackupPrefix  = "backup-" // Backup namespaces will be "backup-{name}-{date}"
	RetentionDays = 7
)

func main() {
	ctx := context.Background()

	sourceClient := turbopuffer.NewClient(option.WithRegion(SourceRegion))
	backupClient := turbopuffer.NewClient(option.WithRegion(BackupRegion))

	timestamp := time.Now().Unix() // Unix epoch seconds
	startTime := time.Now()

	// Step 1: Back up each namespace matching the source prefix
	fmt.Println("Starting backups...")
	var namespaceCount int

	namespaces := sourceClient.NamespacesAutoPaging(ctx, turbopuffer.NamespacesParams{
		Prefix: turbopuffer.String(SourcePrefix),
	})
	for namespaces.Next() {
		ns := namespaces.Current()
		namespaceCount++
		backupName := fmt.Sprintf("%s%s-%010d", BackupPrefix, ns.ID, timestamp)
		fmt.Printf("  Backing up: %s\n", ns.ID)

		backupNs := backupClient.Namespace(backupName)
		_, err := (&backupNs).CopyFrom(ctx, turbopuffer.NamespaceCopyFromParams{
			SourceNamespace: ns.ID,
			SourceRegion:    turbopuffer.String(SourceRegion),
			// if backing up to a different organization, include source_api_key:
			// SourceAPIKey: turbopuffer.String("<source-org-api-key>"),
		})
		if err != nil {
			panic(err)
		}
	}
	if err := namespaces.Err(); err != nil {
		panic(err)
	}

	// Step 2: Delete old backups beyond the retention period (after successful backup)
	fmt.Println("Cleaning up old backups...")
	cutoff := time.Now().Unix() - int64(RetentionDays*86400)
	deleted := 0

	backups := backupClient.NamespacesAutoPaging(ctx, turbopuffer.NamespacesParams{
		Prefix: turbopuffer.String(BackupPrefix),
	})
	for backups.Next() {
		ns := backups.Current()
		// Safety check: only delete namespaces that match our backup prefix
		if len(BackupPrefix) == 0 || !strings.HasPrefix(ns.ID, BackupPrefix) {
			panic(fmt.Sprintf("Refusing to delete namespace that doesn't match backup prefix: %s", ns.ID))
		}

		// Extract timestamp from backup namespace name (e.g., "backup-prod-users-1234567890")
		if len(ns.ID) >= 10 {
			backupTime, err := strconv.ParseInt(ns.ID[len(ns.ID)-10:], 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  Skipping %s: invalid timestamp format\n", ns.ID)
				continue
			}
			if backupTime < cutoff {
				fmt.Printf("  Deleting: %s\n", ns.ID)
				delNs := backupClient.Namespace(ns.ID)
				if _, err := (&delNs).DeleteAll(ctx, turbopuffer.NamespaceDeleteAllParams{}); err != nil {
					panic(err)
				}
				deleted++
			}
		}
	}
	if err := backups.Err(); err != nil {
		panic(err)
	}

	elapsed := time.Since(startTime).Seconds()
	fmt.Printf("Done: backed up %d namespaces, deleted %d old backups in %.1fs\n",
		namespaceCount, deleted, elapsed)
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.core.*;
import com.turbopuffer.models.*;
import com.turbopuffer.models.namespaces.*;

public class BackupNamespaces {

  // Configuration
  static final String SOURCE_REGION = "gcp-us-central1";
  static final String BACKUP_REGION = "gcp-us-west1";
  static final String SOURCE_PREFIX = "fts-"; // Back up all namespaces starting with "fts-"
  static final String BACKUP_PREFIX = "backup-"; // Backup namespaces will be "backup-{name}-{date}"
  static final int RETENTION_DAYS = 7;

  public static void main(String[] args) {
    var baseClient = TurbopufferOkHttpClient.builder().fromEnv();
    var sourceClient = baseClient.region(SOURCE_REGION).build();
    var backupClient = baseClient.region(BACKUP_REGION).build();

    var timestamp = System.currentTimeMillis() / 1000; // Unix epoch seconds
    var startTime = System.currentTimeMillis();

    // Step 1: Back up each namespace matching the source prefix
    System.out.println("Starting backups...");
    int namespaceCount = 0;

    var namespaces = sourceClient.namespaces(
      ClientNamespacesParams.builder().prefix(SOURCE_PREFIX).build()
    );

    for (var ns : namespaces.autoPager()) {
      namespaceCount++;
      var backupName = String.format("%s%s-%010d", BACKUP_PREFIX, ns.id(), timestamp);
      System.out.println("  Backing up: " + ns.id());

      var backupNs = backupClient.namespace(backupName);
      backupNs.copyFrom(
        NamespaceCopyFromParams.builder()
          .sourceNamespace(ns.id())
          .sourceRegion(SOURCE_REGION)
          // if backing up to a different organization, include source_api_key:
          // .sourceApiKey("<source-org-api-key>")
          .build()
      );
    }

    // Step 2: Delete old backups beyond the retention period (after successful backup)
    System.out.println("Cleaning up old backups...");
    var cutoff = System.currentTimeMillis() / 1000 - RETENTION_DAYS * 86400L;
    int deleted = 0;

    var backups = backupClient.namespaces(
      ClientNamespacesParams.builder().prefix(BACKUP_PREFIX).build()
    );

    for (var ns : backups.autoPager()) {
      // Safety check: only delete namespaces that match our backup prefix
      assert !BACKUP_PREFIX.isEmpty() &&
      ns
        .id()
        .startsWith(
          BACKUP_PREFIX
        ) : "Refusing to delete namespace that doesn't match backup prefix: " + ns.id();

      // Extract timestamp from backup namespace name (e.g., "backup-prod-users-1234567890")
      var name = ns.id();
      if (name.length() >= 10) {
        try {
          var backupTime = Long.parseLong(name.substring(name.length() - 10));
          if (backupTime < cutoff) {
            System.out.println("  Deleting: " + ns.id());
            backupClient.namespace(ns.id()).deleteAll();
            deleted++;
          }
        } catch (NumberFormatException e) {
          System.err.println("  Skipping " + ns.id() + ": invalid timestamp format");
        }
      }
    }

    var elapsed = (System.currentTimeMillis() - startTime) / 1000.0;
    System.out.printf(
      "Done: backed up %d namespaces, deleted %d old backups in %.1fs%n",
      namespaceCount,
      deleted,
      elapsed
    );
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using Turbopuffer;
using Turbopuffer.Models;
using Turbopuffer.Models.Namespaces;

// Configuration
const string SOURCE_REGION = "gcp-us-central1";
const string BACKUP_REGION = "gcp-us-west1";
const string SOURCE_PREFIX = "fts-"; // Back up all namespaces starting with "fts-"
const string BACKUP_PREFIX = "backup-"; // Backup namespaces will be "backup-{name}-{date}"
const int RETENTION_DAYS = 7;

using var sourceClient = new TurbopufferClient { Region = SOURCE_REGION };
using var backupClient = new TurbopufferClient { Region = BACKUP_REGION };

var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(); // Unix epoch seconds
var startTime = DateTimeOffset.UtcNow;

// Step 1: Back up each namespace matching the source prefix
Console.WriteLine("Starting backups...");
int namespaceCount = 0;

var namespaces = await sourceClient.Namespaces(
    new ClientNamespacesParams { Prefix = SOURCE_PREFIX }
);

await foreach (var ns in namespaces.Paginate())
{
    namespaceCount++;
    var backupName = $"{BACKUP_PREFIX}{ns.ID}-{timestamp:D10}";
    Console.WriteLine($"  Backing up: {ns.ID}");

    var backupNs = backupClient.Namespace(backupName);
    await backupNs.CopyFrom(
        new NamespaceCopyFromParams
        {
            SourceNamespace = ns.ID,
            SourceRegion = SOURCE_REGION,
            // if backing up to a different organization, include source_api_key:
            // SourceApiKey = "<source-org-api-key>",
        }
    );
}

// Step 2: Delete old backups beyond the retention period (after successful backup)
Console.WriteLine("Cleaning up old backups...");
var cutoff = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - RETENTION_DAYS * 86400L;
int deleted = 0;

var backups = await backupClient.Namespaces(
    new ClientNamespacesParams { Prefix = BACKUP_PREFIX }
);

await foreach (var ns in backups.Paginate())
{
    // Safety check: only delete namespaces that match our backup prefix
    if (BACKUP_PREFIX.Length == 0 || !ns.ID.StartsWith(BACKUP_PREFIX))
    {
        throw new InvalidOperationException(
            $"Refusing to delete namespace that doesn't match backup prefix: {ns.ID}"
        );
    }

    // Extract timestamp from backup namespace name (e.g., "backup-prod-users-1234567890")
    var name = ns.ID;
    if (name.Length >= 10)
    {
        if (long.TryParse(name.Substring(name.Length - 10), out var backupTime))
        {
            if (backupTime < cutoff)
            {
                Console.WriteLine($"  Deleting: {ns.ID}");
                await backupClient.Namespace(ns.ID).DeleteAll(new NamespaceDeleteAllParams());
                deleted++;
            }
        }
        else
        {
            Console.Error.WriteLine($"  Skipping {ns.ID}: invalid timestamp format");
        }
    }
}

var elapsed = (DateTimeOffset.UtcNow - startTime).TotalSeconds;
Console.WriteLine(
    $"Done: backed up {namespaceCount} namespaces, deleted {deleted} old backups in {elapsed:F1}s"
);
```
```ruby
require "turbopuffer"

# Configuration
SOURCE_REGION = "gcp-us-central1"
BACKUP_REGION = "gcp-us-west1"
SOURCE_PREFIX = "fts-" # Back up all namespaces starting with "fts-"
BACKUP_PREFIX = "backup-" # Backup namespaces will be "backup-{name}-{date}"
RETENTION_DAYS = 7

source_client = Turbopuffer::Client.new(region: SOURCE_REGION)
backup_client = Turbopuffer::Client.new(region: BACKUP_REGION)

timestamp = Time.now.to_i # Unix epoch seconds
start_time = Time.now

# Step 1: Back up each namespace matching the source prefix
puts "Starting backups..."
namespace_count = 0

source_client.namespaces(prefix: SOURCE_PREFIX).auto_paging_each do |ns|
  namespace_count += 1
  backup_name = "#{BACKUP_PREFIX}#{ns.id}-#{format("%010d", timestamp)}"
  puts "  Backing up: #{ns.id}"

  backup_ns = backup_client.namespace(backup_name)
  backup_ns.copy_from(
    source_namespace: ns.id,
    source_region: SOURCE_REGION,
    # if backing up to a different organization, include source_api_key:
    # source_api_key: "<source-org-api-key>",
  )
end

# Step 2: Delete old backups beyond the retention period (after successful backup)
puts "Cleaning up old backups..."
cutoff = Time.now.to_i - (RETENTION_DAYS * 86400)
deleted = 0

backup_client.namespaces(prefix: BACKUP_PREFIX).auto_paging_each do |ns|
  # Safety check: only delete namespaces that match our backup prefix
  raise "Refusing to delete namespace that doesn't match backup prefix: #{ns.id}" unless BACKUP_PREFIX.length > 0 && ns.id.start_with?(BACKUP_PREFIX)

  # Extract timestamp from backup namespace name (e.g., "backup-prod-users-1234567890")
  next unless ns.id.length >= 10

  begin
    backup_time = Integer(ns.id[-10..])
    if backup_time < cutoff
      puts "  Deleting: #{ns.id}"
      backup_client.namespace(ns.id).delete_all
      deleted += 1
    end
  rescue ArgumentError
    warn "  Skipping #{ns.id}: invalid timestamp format"
  end
end

elapsed = (Time.now - start_time).round(1)
puts "Done: backed up #{namespace_count} namespaces, deleted #{deleted} old backups in #{elapsed}s"
```
<!-- /multilang -->

See [Limits](/docs/limits) for copy throughput estimates.

## Recovering a Namespace

Backup namespaces are fully functional. You can either point your application
to the namespace in the backup region directly, or copy it to a new namespace
in your preferred region as shown below:

<!-- multilang -->
```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["turbopuffer"]
# ///

import os
import time

import turbopuffer

# Configuration
SOURCE_REGION = "gcp-us-central1"
BACKUP_REGION = "gcp-us-west1"
BACKUP_PREFIX = "backup-"

source_client = turbopuffer.Turbopuffer(
    api_key=os.getenv("TURBOPUFFER_API_KEY"), region=SOURCE_REGION
)
backup_client = turbopuffer.Turbopuffer(
    api_key=os.getenv("TURBOPUFFER_API_KEY"), region=BACKUP_REGION
)

# Find latest backup timestamp (last 10 chars = Unix epoch seconds)
backups = list(backup_client.namespaces(prefix=BACKUP_PREFIX))
timestamps: set[int] = set()
for ns in backups:
    if len(ns.id) >= 10:
        try:
            timestamps.add(int(ns.id[-10:]))
        except ValueError:
            pass
latest = max(timestamps)

print(f"Recovering from backup: {latest}")
start_time = time.time()
recovered = 0

latest_suffix = f"{latest:010d}"
for ns in backups:
    if not ns.id.endswith(latest_suffix):
        continue
    original_name = ns.id[len(BACKUP_PREFIX) : -11]  # -11 for "-" + 10 digits
    recovered_name = f"recovered-py-{original_name}"
    print(f"  {ns.id} -> {recovered_name}")
    source_client.namespace(recovered_name).copy_from(
        source_namespace=ns.id, source_region=BACKUP_REGION
    )
    recovered += 1

print(f"Done: recovered {recovered} namespaces in {time.time() - start_time:.1f}s")
```
```typescript
import { Turbopuffer } from "@turbopuffer/turbopuffer";

// Configuration
const SOURCE_REGION = "gcp-us-central1";
const BACKUP_REGION = "gcp-us-west1";
const BACKUP_PREFIX = "backup-";

const sourceClient = new Turbopuffer({ region: SOURCE_REGION });
const backupClient = new Turbopuffer({ region: BACKUP_REGION });

// Find latest backup timestamp (last 10 chars = Unix epoch seconds)
const backups: { id: string }[] = [];
for await (const ns of backupClient.namespaces({ prefix: BACKUP_PREFIX })) backups.push(ns);
const timestamps = backups
  .map((ns) => (ns.id.length >= 10 ? parseInt(ns.id.slice(-10), 10) : NaN))
  .filter((t) => !isNaN(t));
const latest = Math.max(...timestamps);

console.log(`Recovering from backup: ${latest}`);
const startTime = Date.now();
let recovered = 0;

const latestSuffix = String(latest).padStart(10, "0");
for (const ns of backups) {
  if (!ns.id.endsWith(latestSuffix)) continue;
  const originalName = ns.id.slice(BACKUP_PREFIX.length, -11); // -11 for "-" + 10 digits
  const recoveredName = `recovered-mts-${originalName}`;
  console.log(`  ${ns.id} -> ${recoveredName}`);
  await sourceClient.namespace(recoveredName).copyFrom({
    source_namespace: ns.id,
    source_region: BACKUP_REGION,
  });
  recovered++;
}

console.log(`Done: recovered ${recovered} namespaces in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
```
```go
package main

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strconv"
	"time"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
)

const (
	SourceRegion = "gcp-us-central1"
	BackupRegion = "gcp-us-west1"
	BackupPrefix = "backup-"
)

func main() {
	ctx := context.Background()
	sourceClient := turbopuffer.NewClient(option.WithRegion(SourceRegion))
	backupClient := turbopuffer.NewClient(option.WithRegion(BackupRegion))

	// Find latest backup timestamp (last 10 chars = Unix epoch seconds)
	var backups []string
	timestamps := make(map[int64]bool)
	for iter := backupClient.NamespacesAutoPaging(ctx, turbopuffer.NamespacesParams{Prefix: turbopuffer.String(BackupPrefix)}); iter.Next(); {
		id := iter.Current().ID
		backups = append(backups, id)
		if len(id) >= 10 {
			if ts, err := strconv.ParseInt(id[len(id)-10:], 10, 64); err == nil {
				timestamps[ts] = true
			}
		}
	}
	var tsList []int64
	for ts := range timestamps {
		tsList = append(tsList, ts)
	}
	sort.Slice(tsList, func(i, j int) bool { return tsList[i] < tsList[j] })
	latest := tsList[len(tsList)-1]

	fmt.Printf("Recovering from backup: %d\n", latest)
	startTime := time.Now()
	recovered := 0

	latestSuffix := fmt.Sprintf("%010d", latest)
	for _, nsID := range backups {
		if len(nsID) < 10 || nsID[len(nsID)-10:] != latestSuffix {
			continue
		}
		originalName := nsID[len(BackupPrefix) : len(nsID)-11] // -11 for "-" + 10 digits
		recoveredName := "recovered-go-" + originalName + ""
		fmt.Printf("  %s -> %s\n", nsID, recoveredName)
		targetNs := sourceClient.Namespace(recoveredName)
		if _, err := (&targetNs).CopyFrom(ctx, turbopuffer.NamespaceCopyFromParams{
			SourceNamespace: nsID,
			SourceRegion:    turbopuffer.String(BackupRegion),
		}); err != nil {
			panic(err)
		}
		recovered++
	}

	fmt.Printf("Done: recovered %d namespaces in %.1fs\n", recovered, time.Since(startTime).Seconds())
}
```
```java
package com.turbopuffer.docs;

import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;

public class RecoverNamespace {

  // Configuration
  static final String SOURCE_REGION = "gcp-us-central1";
  static final String BACKUP_REGION = "gcp-us-west1";
  static final String BACKUP_PREFIX = "backup-";

  public static void main(String[] args) {
    var baseClient = TurbopufferOkHttpClient.builder().fromEnv();
    var sourceClient = baseClient.region(SOURCE_REGION).build();
    var backupClient = baseClient.region(BACKUP_REGION).build();

    // Find the latest backup timestamp (last 10 chars = Unix epoch seconds)
    var backupTimestamps = new TreeSet<Long>();

    for (var ns : backupClient
      .namespaces(ClientNamespacesParams.builder().prefix(BACKUP_PREFIX).build())
      .autoPager()) {
      var name = ns.id();
      if (name.length() >= 10) {
        try {
          backupTimestamps.add(Long.parseLong(name.substring(name.length() - 10)));
        } catch (NumberFormatException e) {
          // Skip invalid timestamps
        }
      }
    }

    var latestTimestamp = backupTimestamps.last();
    var latestSuffix = String.format("%010d", latestTimestamp);
    System.out.println("Recovering from backup timestamp: " + latestTimestamp);

    var startTime = System.currentTimeMillis();
    int recovered = 0;

    for (var ns : backupClient
      .namespaces(ClientNamespacesParams.builder().prefix(BACKUP_PREFIX).build())
      .autoPager()) {
      if (!ns.id().endsWith(latestSuffix)) continue;
      var originalName = ns.id().substring(BACKUP_PREFIX.length(), ns.id().length() - 11); // -11 for "-" + 10 digits
      var recoveredName = "recovered-java-" + originalName + "";
      System.out.println("  " + ns.id() + " -> " + recoveredName);
      sourceClient
        .namespace(recoveredName)
        .copyFrom(
          NamespaceCopyFromParams.builder()
            .sourceNamespace(ns.id())
            .sourceRegion(BACKUP_REGION)
            .build()
        );
      recovered++;
    }

    var elapsed = (System.currentTimeMillis() - startTime) / 1000.0;
    System.out.printf("Done: recovered %d namespaces in %.1fs%n", recovered, elapsed);
  }
}
```
```cs
// dotnet add package Turbopuffer
using System;
using System.Collections.Generic;
using Turbopuffer;
using Turbopuffer.Models;
using Turbopuffer.Models.Namespaces;

// Configuration
const string SOURCE_REGION = "gcp-us-central1";
const string BACKUP_REGION = "gcp-us-west1";
const string BACKUP_PREFIX = "backup-";

using var sourceClient = new TurbopufferClient { Region = SOURCE_REGION };
using var backupClient = new TurbopufferClient { Region = BACKUP_REGION };

// Find the latest backup timestamp (last 10 chars = Unix epoch seconds)
var backupTimestamps = new SortedSet<long>();

var backupsForTimestamps = await backupClient.Namespaces(
    new ClientNamespacesParams { Prefix = BACKUP_PREFIX }
);
await foreach (var ns in backupsForTimestamps.Paginate())
{
    var name = ns.ID;
    if (name.Length >= 10)
    {
        if (long.TryParse(name.Substring(name.Length - 10), out var ts))
        {
            backupTimestamps.Add(ts);
        }
        // Skip invalid timestamps
    }
}

var latestTimestamp = backupTimestamps.Max;
var latestSuffix = $"{latestTimestamp:D10}";
Console.WriteLine($"Recovering from backup timestamp: {latestTimestamp}");

var startTime = DateTimeOffset.UtcNow;
int recovered = 0;

var backups = await backupClient.Namespaces(
    new ClientNamespacesParams { Prefix = BACKUP_PREFIX }
);
await foreach (var ns in backups.Paginate())
{
    if (!ns.ID.EndsWith(latestSuffix)) continue;
    var originalName = ns.ID.Substring(
        BACKUP_PREFIX.Length,
        ns.ID.Length - 11 - BACKUP_PREFIX.Length
    ); // -11 for "-" + 10 digits
    var recoveredName = "recovered-csharp-" + originalName + "-" + Environment.GetEnvironmentVariable("NONCE");
    Console.WriteLine($"  {ns.ID} -> {recoveredName}");
    await sourceClient
        .Namespace(recoveredName)
        .CopyFrom(
            new NamespaceCopyFromParams
            {
                SourceNamespace = ns.ID,
                SourceRegion = BACKUP_REGION,
            }
        );
    recovered++;
}

var elapsed = (DateTimeOffset.UtcNow - startTime).TotalSeconds;
Console.WriteLine($"Done: recovered {recovered} namespaces in {elapsed:F1}s");
```
```ruby
require "turbopuffer"

# Configuration
SOURCE_REGION = "gcp-us-central1"
BACKUP_REGION = "gcp-us-west1"
BACKUP_PREFIX = "backup-"

source_client = Turbopuffer::Client.new(region: SOURCE_REGION)
backup_client = Turbopuffer::Client.new(region: BACKUP_REGION)

# Find the latest backup timestamp (last 10 chars = Unix epoch seconds)
backup_timestamps = Set.new
backup_client.namespaces(prefix: BACKUP_PREFIX).auto_paging_each do |ns|
  next unless ns.id.length >= 10

  begin
    backup_timestamps.add(Integer(ns.id[-10..]))
  rescue ArgumentError
    # Skip invalid timestamps
  end
end

latest_timestamp = backup_timestamps.max
puts "Recovering from backup timestamp: #{latest_timestamp}"

start_time = Time.now
recovered = 0

latest_suffix = format("%010d", latest_timestamp)
backup_client.namespaces(prefix: BACKUP_PREFIX).auto_paging_each do |ns|
  next unless ns.id.end_with?(latest_suffix)
  original_name = ns.id[BACKUP_PREFIX.length..-12] # -12 for "-" + 10 digits + 1 (ruby range is inclusive)
  recovered_name = "recovered-rb-#{original_name}"
  puts "  #{ns.id} -> #{recovered_name}"
  source_client.namespace(recovered_name).copy_from(
    source_namespace: ns.id,
    source_region: BACKUP_REGION,
  )
  recovered += 1
end

puts "Done: recovered #{recovered} namespaces in #{(Time.now - start_time).round(1)}s"
```
<!-- /multilang -->

For more details on `copy_from_namespace`, see the [write documentation](/docs/write#param-copy_from_namespace).
