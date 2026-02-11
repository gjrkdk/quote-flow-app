# Phase 15: GraphQL Migration & GDPR - Research

**Researched:** 2026-02-11
**Domain:** Shopify GraphQL Admin API migration, GDPR webhook implementation, async job queuing
**Confidence:** HIGH

## Summary

Phase 15 migrates Shopify Admin API calls from REST to GraphQL (mandatory for App Store submission as of April 2025) and implements functional GDPR webhooks with async data deletion. Research confirms that Draft Order creation already uses GraphQL (`draftOrderCreate` mutation), and product selection uses App Bridge's ResourcePicker (GraphQL-backed). The primary work involves: (1) auditing and documenting existing GraphQL usage, (2) implementing actual data deletion in GDPR webhooks (currently stub implementations), and (3) adding async job processing to meet Shopify's <5 second webhook response requirement.

Critical findings: Shopify deprecated REST Admin API as of October 1, 2024, and mandates GraphQL for all new apps submitted to App Store after April 1, 2025. Existing apps can continue using REST, but must migrate deprecated product/variant endpoints. GDPR webhooks must return 200 OK within 5 seconds (Shopify recommends 2 seconds) to avoid retries, requiring async job queue for long-running deletions. GraphQL rate limits use calculated query cost (50 points/second standard, up to 500 for Shopify Plus), requiring exponential backoff for throttling.

App Bridge ResourcePicker uses GraphQL internally—no migration needed. The codebase already uses GraphQL for Draft Orders. GDPR webhook endpoints exist but only create database records without actual data deletion. Vercel's serverless environment requires careful async job queue selection—BullMQ requires persistent Redis, simpler alternatives include database-backed queues or Vercel-native solutions.

**Primary recommendation:** Document existing GraphQL usage as compliant with App Store requirements. Implement Prisma-based async job queue using database as message store (avoids Redis dependency, works on Vercel serverless). Refactor GDPR webhooks to enqueue deletion jobs immediately, return 200 OK within 200ms, process deletions asynchronously with cascade logic. Add webhook verification tests to validate 200ms response time requirement.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @shopify/shopify-app-remix | 2.7.0 | Shopify GraphQL client | Already in use, provides `admin.graphql()` method for GraphQL queries/mutations, handles authentication and API versioning |
| @shopify/shopify-api | Latest | GraphQL Admin API types | Included with shopify-app-remix, provides TypeScript types for GraphQL operations, handles rate limiting and retries |
| Prisma | 5.8.0 | Database ORM and job queue store | Already in use, can be used as job queue backend (table-based queue pattern), atomic transactions for job processing |
| exponential-backoff | 3.1.3 | Retry logic for rate limits | Already in use for Draft Orders, handles Shopify's 429 Throttled responses with jittered backoff |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | 8.11.3 | PostgreSQL client | Already in use, required for database-backed job queue polling |
| @vercel/functions | 1.3.0 | Vercel Fluid Compute | Already in use for database connection pooling, works with serverless environment |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma job queue | BullMQ + Redis | BullMQ is more feature-rich but requires Redis instance (added cost, maintenance). Prisma-backed queue is simpler, uses existing database, sufficient for moderate job volumes |
| Database queue | Inngest | Inngest is third-party service with free tier but adds external dependency. Database queue keeps everything in-house |
| Async deletion | Synchronous deletion | Synchronous deletion risks webhook timeout (>5 sec = retry storm). Async with immediate 200 OK is Shopify best practice |
| GraphQL client | REST fallback | REST Admin API is legacy as of Oct 2024, mandatory GraphQL for new App Store apps. No valid alternative |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
# GraphQL already in use via @shopify/shopify-app-remix
```

## Architecture Patterns

### Recommended Project Structure

```
app/
├── routes/
│   └── webhooks.tsx                      # EXTEND: Enqueue async jobs, verify response time
├── services/
│   ├── draft-order.server.ts             # VERIFIED: Already uses GraphQL (draftOrderCreate)
│   ├── gdpr-deletion.server.ts           # NEW: Async deletion logic for GDPR
│   └── job-queue.server.ts               # NEW: Database-backed job queue
├── jobs/
│   ├── customer-redact.job.ts            # NEW: Process customer data deletion
│   └── shop-redact.job.ts                # NEW: Process shop data deletion (cascade all)
└── components/
    └── ProductPicker.tsx                 # VERIFIED: Uses App Bridge ResourcePicker (GraphQL)
prisma/
└── schema.prisma                         # EXTEND: Add JobQueue model
```

**Service layer pattern:** Webhook handlers enqueue jobs immediately (<200ms), return 200 OK. Background worker polls job queue, processes deletions with transactions, marks jobs complete.

### Pattern 1: GraphQL Mutation with Error Handling

**What:** Execute GraphQL mutations using Shopify's admin.graphql() method with proper error handling for GraphQL errors and userErrors.

**When to use:** All Shopify Admin API write operations (Draft Orders, Products, Orders, etc.).

**Example:**
```typescript
// Source: Shopify GraphQL Admin API documentation
// Already implemented in app/services/draft-order.server.ts (lines 121-179)

const response = await admin.graphql(
  `#graphql
    mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          totalPrice
          invoiceUrl
        }
        userErrors {
          field
          message
        }
      }
    }`,
  { variables: { input: draftOrderInput } }
);

const data = await response.json();

// Check for GraphQL-level errors
if (data.errors) {
  throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
}

// Check for business logic errors (userErrors)
if (data.data?.draftOrderCreate?.userErrors?.length > 0) {
  const errors = data.data.draftOrderCreate.userErrors
    .map((e: any) => `${e.field}: ${e.message}`)
    .join(", ");
  throw new Error(`Mutation failed: ${errors}`);
}

const result = data.data.draftOrderCreate.draftOrder;
```

**Key points:**
- Always check both `data.errors` (GraphQL errors) and `userErrors` (business logic errors)
- Use `#graphql` template tag for syntax highlighting in supported editors
- Wrap in exponential backoff retry logic for 429 Throttled responses
- Return structured errors to caller for proper HTTP status codes

### Pattern 2: GraphQL Query with Pagination

**What:** Fetch paginated data using cursor-based pagination with PageInfo for handling large datasets.

**When to use:** Fetching lists of resources (products, orders, customers) that may exceed single-page limits (max 250 per page).

**Example:**
```typescript
// Source: https://shopify.dev/docs/api/usage/pagination-graphql

async function* fetchAllProducts(admin: any) {
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query Products($cursor: String) {
          products(first: 250, after: $cursor) {
            nodes {
              id
              title
              handle
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
      { variables: { cursor } }
    );

    const data = await response.json();
    const products = data.data.products;

    yield products.nodes;

    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;
  }
}

// Usage:
for await (const productBatch of fetchAllProducts(admin)) {
  // Process batch of up to 250 products
}
```

**Key points:**
- Use `first` or `last` argument (required for connections)
- Maximum 250 resources per page
- For larger bulk operations (>1000 records), use Bulk Operations API instead
- Cursor is opaque string—don't parse or construct manually

### Pattern 3: Database-Backed Job Queue (Prisma)

**What:** Lightweight job queue using database table for job storage, polling worker for processing.

**When to use:** Async processing for webhooks, scheduled tasks, long-running operations. Serverless-friendly (works on Vercel without Redis).

**Example:**
```typescript
// Source: Background job patterns from Shopify Engineering, adapted for Prisma
// https://shopify.engineering/high-availability-background-jobs

// Schema addition to prisma/schema.prisma:
model JobQueue {
  id          String    @id @default(cuid())
  type        String    // "customer_redact", "shop_redact", etc.
  payload     Json
  status      String    @default("pending") // "pending", "processing", "completed", "failed"
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  scheduledAt DateTime  @default(now()) @map("scheduled_at")
  processedAt DateTime? @map("processed_at")
  error       String?
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([status, scheduledAt])
  @@map("job_queue")
}

// Enqueue job (webhook handler):
export async function enqueueJob(type: string, payload: any) {
  await prisma.jobQueue.create({
    data: {
      type,
      payload,
      status: "pending",
    },
  });
}

// Process jobs (background worker or API route):
export async function processNextJob() {
  // Atomic claim: find pending job and mark as processing
  const job = await prisma.$transaction(async (tx) => {
    const pending = await tx.jobQueue.findFirst({
      where: {
        status: "pending",
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
    });

    if (!pending) return null;

    // Atomically mark as processing
    return tx.jobQueue.update({
      where: { id: pending.id },
      data: {
        status: "processing",
        attempts: { increment: 1 },
      },
    });
  });

  if (!job) return null; // No jobs to process

  try {
    // Execute job logic
    await executeJob(job.type, job.payload);

    // Mark complete
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: "completed",
        processedAt: new Date(),
      },
    });
  } catch (error) {
    // Mark failed or retry
    const newStatus = job.attempts >= job.maxAttempts ? "failed" : "pending";
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: newStatus,
        error: error instanceof Error ? error.message : "Unknown error",
        // Retry with exponential backoff
        scheduledAt: new Date(Date.now() + Math.pow(2, job.attempts) * 1000),
      },
    });
  }
}
```

**Key points:**
- Transaction ensures atomic job claiming (prevents duplicate processing)
- Status field enables simple queries: `WHERE status = 'pending'`
- Exponential backoff for retries (1s, 2s, 4s, 8s, ...)
- Failed jobs remain in database for debugging
- Poll interval: 1-5 seconds (balance latency vs database load)

### Pattern 4: GDPR Webhook with Async Processing

**What:** Webhook handler that enqueues deletion job immediately, returns 200 OK within 200ms.

**When to use:** All Shopify GDPR webhooks (customers/redact, shop/redact).

**Example:**
```typescript
// Source: Shopify webhook best practices
// https://shopify.dev/docs/apps/build/webhooks/best-practices

export const action = async ({ request }: ActionFunctionArgs) => {
  const startTime = Date.now();

  // Authenticate webhook (already implemented)
  const { topic, shop, payload } = await authenticate.webhook(request);

  // Enqueue job IMMEDIATELY (non-blocking)
  await enqueueJob(topic, { shop, payload });

  // Log GDPR request (already implemented)
  await prisma.gdprRequest.create({
    data: {
      shop,
      type: topic,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  const elapsed = Date.now() - startTime;
  console.log(`Webhook ${topic} processed in ${elapsed}ms`);

  // Must return 200 OK quickly (Shopify retries if >5 sec)
  return new Response(null, { status: 200 });
};
```

**Async job implementation:**
```typescript
// jobs/shop-redact.job.ts
export async function processShopRedact(payload: any) {
  const { shop } = payload;

  // Delete all store data with cascade (atomic transaction)
  await prisma.$transaction(async (tx) => {
    // Cascade deletes: matrices → breakpoints, cells, productMatrices, draftOrderRecords
    // Cascade deletes: optionGroups → optionChoices, productOptionGroups
    await tx.store.deleteMany({ where: { shop } });

    // Mark GDPR request processed
    await tx.gdprRequest.updateMany({
      where: { shop, type: "SHOP_REDACT", processedAt: null },
      data: { processedAt: new Date() },
    });
  });

  console.log(`Shop redact completed for ${shop}`);
}
```

**Key points:**
- Webhook handler does minimal work: authenticate, enqueue, return 200 OK
- Target <200ms response time (well under Shopify's 5 sec timeout)
- Actual deletion runs async with proper error handling and retries
- Transaction ensures atomic deletion (all or nothing)
- Prisma cascade deletes handle related records automatically

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GraphQL client | Custom fetch wrapper | admin.graphql() from @shopify/shopify-app-remix | Already integrated, handles authentication, API versioning, rate limiting headers |
| Rate limit retry | Custom retry logic | exponential-backoff library | Already in use, handles jitter, max attempts, configurable backoff strategy |
| Job queue | Custom polling system | Database-backed queue with Prisma transactions | Atomic job claiming, built-in retry logic, uses existing database, no Redis dependency |
| Cursor pagination | Manual cursor tracking | Generator pattern with PageInfo | Type-safe, handles hasNextPage automatically, clear iteration semantics |
| Webhook authentication | Custom HMAC verification | authenticate.webhook() | Shopify library handles HMAC verification, signature validation, topic extraction |

**Key insight:** Shopify's official libraries handle complex edge cases (token refresh, rate limiting, webhook verification) that are error-prone to implement manually. Database-backed job queue is simpler than Redis-based queues for moderate volumes, and works seamlessly with serverless deployments.

## Common Pitfalls

### Pitfall 1: Ignoring userErrors in GraphQL Responses

**What goes wrong:** GraphQL mutation returns 200 OK with `data.errors` null, but `data.data.mutation.userErrors` contains validation errors. Code assumes success and proceeds with null/undefined data.

**Why it happens:** GraphQL separates transport errors (`data.errors`) from business logic errors (`userErrors`). A mutation can execute successfully at the GraphQL layer but fail at the business logic layer.

**How to avoid:** Always check both error locations:
```typescript
if (data.errors) {
  // GraphQL-level error (syntax, authentication, etc.)
  throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
}
if (data.data?.mutation?.userErrors?.length > 0) {
  // Business logic error (validation, permissions, etc.)
  throw new Error(`Mutation failed: ${formatUserErrors(data.data.mutation.userErrors)}`);
}
```

**Warning signs:** Null pointer exceptions when accessing mutation result fields, successful API calls that don't produce expected side effects.

### Pitfall 2: Webhook Response Timeout

**What goes wrong:** GDPR webhook handler attempts synchronous deletion of thousands of records. Response time exceeds 5 seconds. Shopify retries webhook 8 times over 4 hours, causing duplicate deletion attempts and database load spikes.

**Why it happens:** Shopify expects <5 sec response (recommends <2 sec). Large stores have thousands of draft orders, option groups, matrices. Cascade deletes take 10+ seconds.

**How to avoid:** Enqueue deletion job immediately, return 200 OK within 200ms:
```typescript
// BAD: Synchronous deletion
await prisma.store.deleteMany({ where: { shop } }); // 10+ seconds
return new Response(null, { status: 200 }); // Too late, already timed out

// GOOD: Async with job queue
await enqueueJob("shop_redact", { shop }); // <50ms
return new Response(null, { status: 200 }); // Fast response
```

**Warning signs:** Shopify webhook retry notifications, duplicate GDPR request records in database, logs showing webhook processing time >1 second.

### Pitfall 3: GraphQL Rate Limit Throttling Without Retry

**What goes wrong:** App makes burst of GraphQL mutations (e.g., bulk price updates). Shopify returns `200 Throttled` error. Code treats as success or fails permanently without retry.

**Why it happens:** GraphQL rate limiting uses calculated query cost (50-500 points/sec). Complex mutations (draftOrderCreate) cost 10+ points. Burst of 10 mutations = 100 points = rate limit exceeded.

**How to avoid:** Use exponential backoff with retry on 429/Throttled:
```typescript
// Already implemented pattern in draft-order.server.ts (lines 166-178)
await backOff(
  async () => {
    const response = await admin.graphql(query, { variables });
    // ... handle response
  },
  {
    numOfAttempts: 3,
    startingDelay: 1000,
    timeMultiple: 2,
    retry: (error: any) => {
      // Retry on 429 or THROTTLED error
      return error.message?.includes("429") || error.message?.includes("THROTTLED");
    },
  }
);
```

**Warning signs:** Intermittent "Throttled" errors in logs, mutations failing during high-traffic periods, error messages mentioning rate limits.

### Pitfall 4: Non-Atomic Job Queue Processing

**What goes wrong:** Worker fetches pending job, begins processing, another worker fetches same job (race condition), both process same deletion, causing duplicate deletion errors or partial data loss.

**Why it happens:** Without transaction, job status check and update are separate operations. Two workers can read same pending job before either marks it as processing.

**How to avoid:** Use transaction to atomically claim job:
```typescript
// BAD: Race condition
const job = await prisma.jobQueue.findFirst({ where: { status: "pending" } });
await prisma.jobQueue.update({ where: { id: job.id }, data: { status: "processing" } });
// ⚠️ Another worker might have fetched same job

// GOOD: Atomic claim
const job = await prisma.$transaction(async (tx) => {
  const pending = await tx.jobQueue.findFirst({ where: { status: "pending" } });
  if (!pending) return null;
  return tx.jobQueue.update({
    where: { id: pending.id },
    data: { status: "processing" },
  });
});
```

**Warning signs:** Duplicate deletion errors in logs, jobs processed multiple times, race condition errors in database.

## Code Examples

Verified patterns from official sources and existing codebase:

### GraphQL Draft Order Creation (Already Implemented)

```typescript
// Source: app/services/draft-order.server.ts (lines 121-179)
// Pattern: GraphQL mutation with retry logic and error handling

const draftOrderResult = await backOff(
  async () => {
    const response = await admin.graphql(
      `#graphql
        mutation DraftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
              totalPrice
              invoiceUrl
            }
            userErrors {
              field
              message
            }
          }
        }`,
      { variables: { input: draftOrderInput } }
    );

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    if (data.data?.draftOrderCreate?.userErrors?.length > 0) {
      const errors = data.data.draftOrderCreate.userErrors
        .map((e: any) => `${e.field}: ${e.message}`)
        .join(", ");
      throw new Error(`Draft Order creation failed: ${errors}`);
    }

    if (!data.data?.draftOrderCreate?.draftOrder) {
      throw new Error("Draft Order not returned from Shopify");
    }

    return data.data.draftOrderCreate;
  },
  {
    numOfAttempts: 3,
    startingDelay: 1000,
    timeMultiple: 2,
    maxDelay: 5000,
    jitter: "full",
    retry: (error: any) => {
      const is429 = error.message?.includes("429") || error.message?.includes("RATE_LIMITED");
      return is429;
    },
  }
);
```

### App Bridge ResourcePicker (Already Implemented)

```typescript
// Source: app/components/ProductPicker.tsx (lines 42-64)
// Pattern: App Bridge ResourcePicker (uses GraphQL internally)

const shopify = useAppBridge();

const handleOpenPicker = useCallback(async () => {
  try {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      filter: {
        hidden: false,
        variants: false,
      },
    });

    if (selected && selected.length > 0) {
      const products = selected.map((product) => ({
        id: product.id,
        title: product.title,
      }));
      onAssign(products);
    }
  } catch (error) {
    // User cancelled picker
    console.log("Product picker cancelled", error);
  }
}, [shopify, onAssign]);
```

**Note:** App Bridge ResourcePicker uses GraphQL Admin API internally. No migration needed—already compliant.

### GDPR Webhook Handler (Current Implementation - Needs Async Queue)

```typescript
// Source: app/routes/webhooks.tsx (lines 26-50)
// Current implementation: synchronous deletion (needs async refactor)

switch (topic) {
  case "CUSTOMERS_DATA_REQUEST":
    // Shopify requires acknowledgement; customer data collection
    // will be implemented when the app stores customer-specific data.
    break;

  case "CUSTOMERS_REDACT":
    // ⚠️ TODO: Currently marks as processed without actual deletion
    await prisma.gdprRequest.updateMany({
      where: { shop, type: GdprRequestType.CUSTOMERS_REDACT, processedAt: null },
      data: { processedAt: new Date() },
    });
    break;

  case "SHOP_REDACT":
    // ⚠️ TODO: Synchronous deletion - should be async
    await prisma.store.deleteMany({ where: { shop } });
    await prisma.gdprRequest.updateMany({
      where: { shop, type: GdprRequestType.SHOP_REDACT, processedAt: null },
      data: { processedAt: new Date() },
    });
    break;
}
```

**Migration needed:** Enqueue async jobs instead of synchronous deletion.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| REST Admin API | GraphQL Admin API | Oct 2024 (legacy), Apr 2025 (mandatory for new apps) | GraphQL is mandatory for App Store submission, REST endpoints deprecated |
| Synchronous webhook processing | Async job queue pattern | Best practice since 2019 | Prevents timeout retries, enables reliable long-running operations |
| Third-party cookies | Session tokens | 2023-2025 transition | Session tokens mandatory for embedded apps, cookies blocked by browsers |
| BullMQ + Redis | Database-backed queues | Serverless era (2020+) | Simpler deployment on platforms like Vercel without Redis infrastructure |
| Manual cursor pagination | Generator pattern with PageInfo | GraphQL standard | Type-safe iteration, clear semantics, handles edge cases |

**Deprecated/outdated:**
- **REST Admin API**: Marked legacy Oct 2024, new apps must use GraphQL as of Apr 2025
- **Bulk query without pagination**: GraphQL enforces `first`/`last` argument, max 250 per page
- **Synchronous webhook processing**: Shopify best practices recommend async processing since 2019
- **Custom app deprecation (2026)**: Access Token Auth being phased out for new custom apps starting 2026

## Open Questions

### 1. Worker Process for Job Queue

**What we know:** Database-backed job queue needs polling worker to process jobs. Vercel serverless functions are stateless and time-limited (5 min max).

**What's unclear:** Best approach for continuous job processing on Vercel:
- **Option A:** Cron endpoint that processes N jobs per invocation (e.g., every minute via Vercel Cron)
- **Option B:** External worker (separate Heroku dyno, Railway service, etc.)
- **Option C:** Vercel Edge Function with long polling (experimental)
- **Option D:** API route that processes one job per call, triggered by webhook or external scheduler

**Recommendation:** Start with **Option A (Vercel Cron)**—simple, built-in, sufficient for moderate job volume. Process up to 10 jobs per cron invocation. Monitor job queue depth; if consistently backlogged, move to external worker (Option B).

### 2. Customer Data Scope for CUSTOMERS_REDACT

**What we know:** Current implementation doesn't store customer-specific data (no customer IDs in database). CUSTOMERS_REDACT webhook creates log record but performs no deletion.

**What's unclear:** What constitutes "customer data" for this app? DraftOrderRecord stores dimensions/prices but no customer PII. Does Shopify consider draft order records "customer data"?

**Recommendation:** Assume draft orders are NOT customer-specific (they're product-based quotes). Leave CUSTOMERS_REDACT as acknowledgment-only until app explicitly stores customer data (future feature). Document this decision in webhook handler comments.

### 3. Job Queue Retention Policy

**What we know:** Completed/failed jobs remain in database indefinitely.

**What's unclear:** When to purge old job records? Keep for debugging vs database bloat.

**Recommendation:** Add cleanup task: delete completed jobs older than 30 days, keep failed jobs for 90 days. Run as separate cron job (daily at low-traffic time). Add `createdAt` index to JobQueue model for efficient pruning.

## Sources

### Primary (HIGH confidence)

- [Shopify GraphQL Admin API - draftOrderCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftordercreate) - Official mutation documentation
- [Shopify API Pagination with GraphQL](https://shopify.dev/docs/api/usage/pagination-graphql) - Official pagination guide
- [Shopify API Rate Limits](https://shopify.dev/docs/api/usage/limits) - Official rate limiting documentation
- [Shopify Webhook Best Practices](https://shopify.dev/docs/apps/build/webhooks/best-practices) - Official webhook guidance
- [Shopify GDPR Webhooks - Privacy Law Compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) - Official GDPR requirements
- [Starting April 2025: GraphQL Mandatory for New Apps](https://shopify.dev/changelog/starting-april-2025-new-public-apps-submitted-to-shopify-app-store-must-use-graphql) - Official deprecation announcement
- Existing codebase: app/services/draft-order.server.ts, app/routes/webhooks.tsx, app/components/ProductPicker.tsx

### Secondary (MEDIUM confidence)

- [Shopify Engineering: High Availability Background Jobs](https://shopify.engineering/high-availability-background-jobs) - Official engineering blog, outbox/SAGA patterns
- [Shopify Engineering: GraphQL Rate Limiting by Query Complexity](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity) - Official engineering blog, cost calculation
- [Vercel Functions Documentation](https://vercel.com/docs/functions) - Official Vercel serverless functions guide
- [BullMQ Documentation](https://bullmq.io/) - Official BullMQ job queue library
- [Prisma Soft Delete Middleware](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware/soft-delete-middleware) - Official Prisma pattern

### Tertiary (LOW confidence - marked for validation)

- [Hookdeck: Shopify Webhooks Best Practices](https://hookdeck.com/webhooks/platforms/shopify-webhooks-best-practices-revised-and-extended) - Third-party guide, not official Shopify
- Community forum discussions on GDPR webhook testing and implementation (various)

## Metadata

**Confidence breakdown:**
- GraphQL API patterns: HIGH - Official Shopify docs, existing codebase demonstrates patterns
- GDPR webhook requirements: HIGH - Official Shopify docs, clear requirements and timelines
- Job queue architecture: MEDIUM - Multiple valid approaches, serverless constraints require careful choice
- App Store requirements: HIGH - Official changelog confirms GraphQL mandatory as of Apr 2025

**Research date:** 2026-02-11
**Valid until:** 90 days (May 2026) for API versioning, 180 days for architectural patterns
