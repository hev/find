---
title: "Testing"
description: "In your tests and development environment we suggest hitting production turbopuffer for the best end to end testing. Since creating a namespace in tur"
group: "Guides"
---

In your tests and development environment we suggest hitting production
turbopuffer for the best end to end testing. Since creating a namespace in
turbopuffer is virtually free, you can create a namespace for each test with a
random name, and simply delete it after the test.

For tests against real data, or to give each developer their own copy, use
[branching](/docs/branching) to instantly clone a production namespace. Delete
the branch when done — the source namespace is unaffected.

To separate test and production infrastructure, consider creating a separate
organization in the dashboard. For cross-region or cross-org copies, use
[`copy_from_namespace`](/docs/backups).

<!-- multilang -->
```python
# tpuf_test.py

# Run with `pytest tpuf_test.py`.

import pytest
import string
import random
import turbopuffer
from turbopuffer.lib import namespace

tpuf = turbopuffer.Turbopuffer(
    region='gcp-us-central1', # pick the right region: https://turbopuffer.com/docs/regions
)

# Create a namespace for each test, and always delete it afterwards
@pytest.fixture
def tpuf_ns():
    random_suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    ns_name = f"test-{random_suffix}"
    ns = tpuf.namespace(ns_name)
    try:
        yield ns
    finally:
        try:
            ns.delete_all()
        except turbopuffer.NotFoundError:
            # If the namespace never got created, no cleanup is needed.
            pass

def test_query(tpuf_ns: namespace.Namespace):
    tpuf_ns.write(
      upsert_rows=[
        {"id": 1, "vector": [1, 1]},
        {"id": 2, "vector": [2, 2]}
      ],
      distance_metric="cosine_distance",
    )
    res = tpuf_ns.query(rank_by=("vector", "ANN", [1.1, 1.1]), limit=10)
    assert res.rows[0].id == 1
```
```typescript
// tpuf.test.ts

// Run with `vitest ./tpuf.test.ts`.

import { expect, test, beforeEach, afterEach, describe } from 'vitest'
import { NotFoundError, Turbopuffer } from "@turbopuffer/turbopuffer";
import { Namespace } from "@turbopuffer/turbopuffer/resources";
import * as crypto from "crypto";

const tpuf = new Turbopuffer({
  region: "gcp-us-central1", // pick the right region: https://turbopuffer.com/docs/regions
});

describe("Turbopuffer namespace tests", () => {
  let ns: Namespace;

  beforeEach(async () => {
    const randomSuffix = crypto.randomBytes(16).toString("hex");
    const nsName = `test-${randomSuffix}`;
    ns = tpuf.namespace(nsName);
  });

  afterEach(async () => {
    try {
      await ns.deleteAll();
    } catch (e: any) {
      if (!(e instanceof NotFoundError)) {
        // If the namespace never got created, no cleanup is needed.
        throw e;
      }
    }
  });

  test("query test", async () => {
    await ns.write({
      upsert_rows: [
        { id: 1, vector: [1, 1] },
        { id: 2, vector: [2, 2] },
      ],
      distance_metric: "euclidean_squared",
    });
    const res = await ns.query({
      rank_by: ["vector", "ANN", [1.1, 1.1]],
      limit: 10,
    });
    expect(res.rows![0].id).toBe(1);
  });
});
```
```go
// tpuf_test.go

// Run with `go test ./yourpkg`.

package yourpkg_tests

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"testing"

	"github.com/turbopuffer/turbopuffer-go/v2"
	"github.com/turbopuffer/turbopuffer-go/v2/option"
	"github.com/turbopuffer/turbopuffer-go/v2/packages/respjson"
)

// Helper function that invokes a test function f with a turbopuffer namespace
// and ensures the namespace is deleted after f returns (even if it fails).
func runTurbopufferTest(t *testing.T, f func(ctx context.Context, ns turbopuffer.Namespace)) {
	ctx := context.Background()
	// Pick the right region: https://turbopuffer.com/docs/regions
	client := turbopuffer.NewClient(option.WithRegion("gcp-us-central1"))

	// Generate a random name for the test namespace.
	name := fmt.Sprintf("test-%016x%016x", rand.Uint64(), rand.Uint64())
	namespace := client.Namespace(name)

	// Delete the namespace after the test, even if the test fails.
	defer func() {
		_, err := namespace.DeleteAll(ctx, turbopuffer.NamespaceDeleteAllParams{})
		if err != nil {
			var apiError *turbopuffer.Error
			if errors.As(err, &apiError) && apiError.StatusCode == 404 {
				// Ignore errors due to the namespace being deleted. The test
				// might have failed before creating it.
				return
			}
			t.Fatalf("unable to delete test namespace: %s: %v", name, err)
		}
	}()

	f(ctx, namespace)
}

func TestQuery(t *testing.T) {
	runTurbopufferTest(t, func(ctx context.Context, ns turbopuffer.Namespace) {
		_, err := ns.Write(ctx, turbopuffer.NamespaceWriteParams{
			UpsertRows: []turbopuffer.RowParam{
				{
					"id":     1,
					"vector": []float32{1.1, 1.1},
				},
			},
			DistanceMetric: turbopuffer.DistanceMetricCosineDistance,
		})
		if err != nil {
			t.Fatal(err)
		}
		res, err := ns.Query(ctx, turbopuffer.NamespaceQueryParams{
			RankBy: turbopuffer.NewRankByAnn("vector", []float32{1.1, 1.1}),
			Limit: turbopuffer.LimitParam{
				Total: 10,
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		if res.Rows[0]["id"] != respjson.Number("1") {
			t.Fatal("wrong row returned")
		}
	})
}

func TestOther(t *testing.T) {
	runTurbopufferTest(t, func(ctx context.Context, ns turbopuffer.Namespace) {
		// Your test code here.
	})
}
```
```java
// TpufTest.java

package com.turbopuffer.docs;

import static org.junit.jupiter.api.Assertions.*;

import com.turbopuffer.client.*;
import com.turbopuffer.client.okhttp.*;
import com.turbopuffer.models.namespaces.*;
import java.util.*;
import org.junit.jupiter.api.*;

public class TpufTest {

  Namespace ns;

  @BeforeEach
  public void setUp() {
    var rand = new Random();
    var tpuf = TurbopufferOkHttpClient.builder()
      .fromEnv()
      // Pick the right region: https://turbopuffer.com/docs/regions
      .region("gcp-us-central1")
      .build();
    ns = tpuf.namespace(String.format("test-%016x%016x", rand.nextLong(), rand.nextLong()));
  }

  @AfterEach
  public void tearDown() {
    ns.deleteAll();
  }

  @Test
  public void testQuery() {
    ns.write(
      NamespaceWriteParams.builder()
        .addUpsertRow(Row.builder().put("id", 1).put("vector", List.of(1, 1)).build())
        .addUpsertRow(Row.builder().put("id", 2).put("vector", List.of(2, 2)).build())
        .distanceMetric(DistanceMetric.COSINE_DISTANCE)
        .build()
    );

    var result = ns.query(
      NamespaceQueryParams.builder()
        .rankBy(RankBy.ann("vector", List.of(1.0f, 1.0f)))
        .limit(10)
        .build()
    );
    var rows = result.rows().get();

    assertEquals(2, rows.size());
    assertEquals(1, rows.get(0).get("id").asNumber().get());
  }
}
```
```cs
// TpufTest.cs

// dotnet add package Turbopuffer
// dotnet add package xunit
//
// Run with `dotnet test`.
using System;
using System.Threading.Tasks;
using Turbopuffer;
using Turbopuffer.Exceptions;
using Turbopuffer.Models.Namespaces;
using Turbopuffer.Services;
using Xunit;

public class TpufTest : IAsyncLifetime
{
    private readonly TurbopufferClient _tpuf = new()
    {
        // Pick the right region: https://turbopuffer.com/docs/regions
        Region = "gcp-us-central1",
    };

    private INamespaceService _ns = null!;

    // Create a namespace for each test, and always delete it afterwards.
    public Task InitializeAsync()
    {
        _ns = _tpuf.Namespace($"test-{Guid.NewGuid():N}");
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        try
        {
            await _ns.DeleteAll(new NamespaceDeleteAllParams());
        }
        catch (TurbopufferNotFoundException)
        {
            // If the namespace never got created, no cleanup is needed.
        }
        _tpuf.Dispose();
    }

    [Fact]
    public async Task TestQuery()
    {
        await _ns.Write(
            new NamespaceWriteParams
            {
                UpsertRows =
                [
                    new Row().Set("id", 1).Set("vector", new[] { 1.0f, 1.0f }),
                    new Row().Set("id", 2).Set("vector", new[] { 2.0f, 2.0f }),
                ],
                DistanceMetric = DistanceMetric.CosineDistance,
            }
        );

        var result = await _ns.Query(
            new NamespaceQueryParams
            {
                RankBy = RankBy.Ann("vector", new[] { 1.1f, 1.1f }),
                Limit = 10,
            }
        );
        var rows = result.GetRows();

        Assert.Equal(2, rows.Count);
        Assert.Equal(1, rows[0].Get<int>("id"));
    }
}
```
```ruby
# tpuf_test.rb

# Run with `ruby tpuf_test.rb`.

require "minitest/autorun"
require "securerandom"
require "turbopuffer"

class TestTpuf < Minitest::Test
  # Create a namespace for each test
  def setup
    tpuf = Turbopuffer::Client.new(
      region: "gcp-us-central1", # pick the right region: https://turbopuffer.com/docs/regions
    )
    @ns = tpuf.namespace("test-#{SecureRandom.alphanumeric(32)}")
  end

  # Always delete the namespace after the test
  def teardown
    @ns.delete_all
  rescue Turbopuffer::Errors::NotFoundError
    # If the namespace never got created, no cleanup is needed.
  end

  def test_query
    @ns.write(
      upsert_rows: [
        { id: 1, vector: [1, 1] },
        { id: 2, vector: [2, 2] },
      ],
      distance_metric: Turbopuffer::DistanceMetric::COSINE_DISTANCE,
    )
    res = @ns.query(rank_by: ["vector", "ANN", [1.1, 1.1]], limit: 10)
    assert_equal(res.rows.first.id, 1)
  end
end
```
<!-- /multilang -->
