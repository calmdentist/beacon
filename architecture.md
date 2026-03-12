# Beacon MVP Architecture

## 1. Purpose

This document describes a concrete architecture for the **Beacon MVP**.

Beacon’s MVP lets a user:

* have an interesting exploration inside an LLM interface
* invoke `@Beacon this` / `Export to Beacon`
* create a structured Beacon object from the current inquiry
* save it to a Beacon web app
* optionally mark the Beacon as open to matching
* see related Beacons / people who may be exploring the same thing or able to help
* request an intro

This architecture is optimized for:

* fast shipping
* small team / solo founder feasibility
* low ops burden
* clean path from MVP to v2

Frontend preference: **Next.js + Vercel**.

AWS credits can be used where they provide leverage, especially for backend APIs, queueing, storage, and background jobs.

---

## 2. Product scope for MVP

### In scope

* Next.js web app for dashboard, Beacon detail pages, matching inbox, intro requests
* auth and user accounts
* Beacon creation via:

  * manual form in web app
  * MCP / app server action from LLM context
* structured Beacon storage
* private-by-default Beacons
* opt-in per Beacon for matching
* simple matchmaking engine
* intro request flow
* admin tooling for manual review / debugging

### Out of scope

* full social feed
* public profiles as primary UX
* complex privacy matrix
* graph / garden UI
* advanced messaging system
* enterprise workspaces
* deep analytics platform
* cross-provider sync perfection

---

## 3. Architectural principles

1. **Keep the core object simple**
   The Beacon object is the center of the system.

2. **Capture is thin, web app is the system of record**
   The MCP / app server should package inquiry context into a Beacon draft, but the Beacon app owns storage, matching, and user state.

3. **Private by default, explicit opt-in to matching**
   For MVP, this is a product rule more than a sophisticated privacy architecture.

4. **Cheap candidate retrieval, smarter reranking later**
   Start with embedding retrieval plus simple heuristics. Add LLM reranking after basic usage is validated.

5. **Use managed infrastructure wherever possible**
   Minimize DevOps and optimize for iteration speed.

---

## 4. Recommended stack

## Frontend

* **Next.js 15+** on **Vercel**
* TypeScript
* Tailwind CSS
* shadcn/ui
* NextAuth or Auth.js-compatible auth layer

## Backend / APIs

Two viable approaches:

### Preferred MVP approach

* **Next.js API routes / Route Handlers** for core app backend
* separate lightweight **MCP server** on AWS for LLM tool integrations

This keeps most product logic close to the web app while allowing the MCP server to evolve independently.

## Database

* **Postgres**
* Recommended: **Neon** or **Supabase Postgres** if you want speed of setup
* Alternative if you want to burn AWS credits: **Amazon RDS Postgres**

For MVP, I recommend **Neon Postgres** unless you already strongly prefer Supabase or AWS-native DBs.

## Vector / embeddings

Two options:

* **pgvector** in Postgres for MVP
* dedicated vector DB later if needed

Recommendation: use **pgvector** in the same Postgres DB for simplicity.

## Background jobs / async work

* **Inngest** or **Trigger.dev** for background workflows
* Alternative AWS-native path: **SQS + Lambda**

Recommendation: **Inngest** if you want developer speed. Use AWS only if you want more infra control.

## Object storage

* minimal need for MVP
* if needed for logs / exports / uploaded files: **S3**

## LLM / extraction layer

* OpenAI API or Anthropic API for:

  * Beacon draft generation from inquiry context
  * normalization
  * optional reranking / reason generation
* embeddings model for semantic retrieval

## MCP server hosting

* **AWS ECS Fargate** or **AWS Lambda** behind API Gateway

Recommendation:

* if MCP server needs long-lived HTTP transport / more flexibility, use **ECS Fargate**
* if usage is light and request/response oriented, **Lambda** can work

For MVP, I would choose **ECS Fargate** if you expect interactive MCP tooling and want fewer cold-start quirks.

---

## 5. High-level system architecture

```text
+-----------------------+
|   LLM Surface         |
| ChatGPT / MCP client  |
| Claude-compatible app |
+-----------+-----------+
            |
            | Export inquiry / create Beacon draft
            v
+-----------------------+
|   MCP Server          |
|  AWS-hosted           |
|  Tool: create_beacon  |
+-----------+-----------+
            |
            | Authenticated API request
            v
+-----------------------+        +----------------------+
|  Beacon App Backend   | <----> |  Postgres + pgvector |
|  Next.js API routes   |        |  users, beacons,     |
|  on Vercel            |        |  matches, intros     |
+-----------+-----------+        +----------------------+
            |
            | background jobs
            v
+-----------------------+
| Matching / jobs       |
| Inngest / Trigger.dev |
+-----------------------+
            |
            v
+-----------------------+
| Email / notifications |
| Resend / Postmark     |
+-----------------------+
```

---

## 6. Core components

## 6.1 Next.js web app

Responsibilities:

* landing page and waitlist
* signup / login
* user dashboard
* Beacon detail / edit pages
* matching toggle per Beacon
* match inbox
* intro request UI
* admin dashboard for manual review

App routes (example):

* `/`
* `/login`
* `/onboarding`
* `/dashboard`
* `/beacons/[id]`
* `/matches`
* `/intros`
* `/settings`
* `/admin`

### Why keep this on Vercel

* fast iteration
* excellent fit with Next.js
* simple deploy pipeline
* preview deployments are useful for rapid product iteration

---

## 6.2 Beacon app API layer

This can live inside the Next.js codebase as route handlers.

Responsibilities:

* authenticate requests
* create / update / delete Beacons
* manage matching flags
* query related Beacons
* create intro requests
* read intro state
* trigger background jobs

Example API routes:

* `POST /api/beacons`
* `PATCH /api/beacons/:id`
* `GET /api/beacons/:id`
* `POST /api/beacons/:id/open-to-matching`
* `GET /api/beacons/:id/related`
* `POST /api/intros/request`
* `POST /api/intros/:id/accept`
* `GET /api/matches`

---

## 6.3 MCP server

Responsibilities:

* expose one or more MCP tools to supported LLM clients
* authenticate user session / API token
* accept inquiry context
* create Beacon draft payload
* optionally send user to Beacon review page

### Primary MVP tool

`create_beacon_from_context`

#### Input

A structured payload representing the current inquiry context, for example:

* `title` (optional)
* `summary` (optional)
* `conversation_context` or distilled context string
* `source_llm`
* `user_id` or auth token

#### Output

A Beacon draft object:

* `title`
* `summary`
* `exploring`
* `help_wanted`
* `tags`
* `suggested_matchable`
* `draft_id`
* `review_url`

### Why keep MCP server separate

* isolates tool-specific concerns from main app
* easier to iterate independently as different app surfaces evolve
* easier to swap transport / auth approaches later

### AWS recommendation

* deploy as a small containerized service on **ECS Fargate**
* put behind ALB or API Gateway depending on MCP transport needs
* store secrets in AWS Secrets Manager
* emit logs to CloudWatch

---

## 6.4 Database

Use Postgres as the primary data store.

### Core tables

#### users

* `id`
* `email`
* `name`
* `created_at`
* `updated_at`

#### profiles

* `user_id`
* `bio`
* `interests`
* `timezone`
* `matching_enabled`

#### beacons

* `id`
* `user_id`
* `title`
* `summary`
* `exploring`
* `help_wanted`
* `tags` (jsonb or text[])
* `source_llm`
* `source_type`
* `status` (`draft`, `saved`, `archived`)
* `is_matchable` (boolean)
* `created_at`
* `updated_at`

#### beacon_embeddings

* `beacon_id`
* `embedding` (vector)
* `embedding_model`
* `updated_at`

#### matches

* `id`
* `beacon_id`
* `matched_beacon_id`
* `match_type`
* `score`
* `reason`
* `status` (`suggested`, `dismissed`, `intro_requested`, `accepted`)
* `created_at`

#### intro_requests

* `id`
* `from_user_id`
* `to_user_id`
* `from_beacon_id`
* `to_beacon_id`
* `status` (`pending`, `accepted`, `declined`, `expired`)
* `created_at`

#### intro_threads

* `id`
* `intro_request_id`
* `created_at`

#### intro_messages

* `id`
* `thread_id`
* `sender_user_id`
* `body`
* `created_at`

#### audit_logs

* `id`
* `user_id`
* `action`
* `entity_type`
* `entity_id`
* `metadata`
* `created_at`

---

## 6.5 Matching service

For MVP, this does not need to be a standalone service. It can be background jobs + helper modules.

Responsibilities:

* generate embedding for each matchable Beacon
* retrieve similar Beacons
* compute simple match scores
* save top matches
* optionally generate short reasons

### Matching pipeline (MVP)

#### Step 1: normalize Beacon

When a Beacon is created or edited:

* clean text fields
* derive a canonical text block from:

  * title
  * summary
  * exploring
  * help_wanted
  * tags

#### Step 2: generate embedding

* compute embedding on canonical text block
* store in `beacon_embeddings`

#### Step 3: retrieve candidates

* vector similarity search against other matchable Beacons
* filter out same user
* optionally filter archived / stale Beacons

#### Step 4: score candidates

Simple score function:

* semantic similarity score
* tag overlap bonus
* complementarity bonus if one Beacon’s `help_wanted` matches another’s `exploring`
* freshness bonus for recent Beacons

#### Step 5: persist top N

* write top 3–5 suggestions into `matches`

#### Step 6: optional explanation generation

Use LLM only for top candidates to produce user-facing reason text.

Example reason:

> Exploring a similar topic from an adjacent angle. This Beacon appears stronger on experimental design, while yours is stronger on theory.

### Future upgrades

* explicit skill / need extraction
* reranking model
* acceptance prediction
* personalized match preferences

---

## 6.6 Notification service

Use a transactional email provider for MVP.

Recommended:

* **Resend**
* Postmark as alternative

Use email for:

* welcome email
* intro request notification
* intro accepted notification
* important product activity

Do not overbuild notifications initially.

---

## 7. Request flows

## 7.1 Flow: user creates Beacon manually in web app

```text
User -> Next.js UI -> POST /api/beacons
                    -> store Beacon in Postgres
                    -> enqueue background job: generate embedding + matches
                    -> return Beacon
```

### Sequence

1. user fills in simple Beacon form
2. backend stores Beacon as `saved`
3. if `is_matchable = true`, background job runs matching pipeline
4. dashboard updates with related Beacons later

---

## 7.2 Flow: user invokes `@Beacon this` from MCP / app surface

```text
User in LLM UI
  -> MCP tool: create_beacon_from_context
  -> MCP server receives inquiry context
  -> MCP server calls Beacon app API
  -> Beacon app stores draft Beacon
  -> returns draft + review URL
  -> user opens review page in Beacon app
  -> user confirms / edits / saves
```

### Sequence

1. user triggers Beacon tool in LLM context
2. MCP server receives structured context
3. MCP server calls extraction function or LLM to draft Beacon fields
4. Beacon app stores Beacon as `draft`
5. user reviews in web app
6. once confirmed, Beacon becomes `saved`
7. if matchable, matching pipeline runs

### Why use a review page

* keeps product clear and trustworthy
* avoids silently creating social objects from chat context
* simplifies debugging and editing

---

## 7.3 Flow: matching pipeline

```text
Beacon saved/updated
  -> enqueue job
  -> generate embedding
  -> retrieve candidates from pgvector
  -> score candidates
  -> write top matches to matches table
```

### Trigger conditions

* Beacon created and set to matchable
* Beacon edited significantly
* periodic refresh for active Beacons

---

## 7.4 Flow: intro request

```text
User clicks Request Intro
  -> POST /api/intros/request
  -> create intro_request row
  -> send email / in-app notification
  -> recipient accepts
  -> create intro thread
```

### Sequence

1. requester clicks on a suggested match
2. intro request is recorded
3. recipient gets notification
4. if accepted, simple thread opens or email handoff occurs

For MVP, in-app thread is nice but optional. Email handoff is acceptable.

---

## 8. Auth and identity

### Recommendation

Use **NextAuth / Auth.js** with:

* Google login
* magic link email login

Why:

* very low friction
* enough for MVP
* avoids building custom auth

### MCP auth

For MCP server, use either:

* short-lived signed tokens issued by Beacon app
* API keys tied to user account for private beta

For MVP private beta, simplest flow:

* user logs into Beacon web app
* generates/connects token for MCP tool

---

## 9. Data privacy / trust model for MVP

This should stay simple.

### Product rules

* Nothing is imported unless user explicitly invokes Beacon
* Every newly created Beacon is private by default
* Matching only runs when user enables it for that Beacon
* Raw full transcript storage is not required for MVP

### Recommended storage approach

Store only structured Beacon fields by default:

* title
* summary
* exploring
* help_wanted
* tags

Optional private source note can be added later, but do not require full transcript persistence.

This keeps the surface area small and easier to explain.

---

## 10. Deployment plan

## 10.1 Frontend / core app

* deploy Next.js app to **Vercel**
* use Vercel env vars for app secrets
* configure preview deployments

## 10.2 Database

Two recommended options:

### Option A: Neon Postgres

Best for speed and simplicity.

### Option B: AWS RDS Postgres

Best if you want to use credits and centralize infra.

My recommendation: **start with Neon**, move to RDS later only if needed.

## 10.3 MCP server

Deploy on **AWS ECS Fargate**.

Why:

* clean separation from app backend
* good use of AWS credits
* flexible for evolving MCP transport requirements
* less operational weirdness than Lambda for interactive tooling

## 10.4 Background jobs

Use **Inngest** initially.

Why:

* less ops
* easy event-driven flows
* integrates well with Vercel / Next.js

If later you want AWS-native jobs:

* SQS + Lambda

## 10.5 Email

Use **Resend**.

---

## 11. Suggested repository structure

### Option 1: monorepo (recommended)

```text
/apps
  /web        # Next.js app on Vercel
  /mcp        # MCP server on AWS
/packages
  /db         # Prisma/Drizzle schema + DB client
  /ui         # shared components if desired
  /core       # shared types, validators, domain logic
  /ai         # extraction prompts, matching helpers
```

Why monorepo:

* shared TypeScript types
* easier coordination between web and MCP layers
* simple for small team

### ORM recommendation

* **Drizzle ORM** or **Prisma**

My recommendation:

* **Drizzle** if you want control and simplicity
* **Prisma** if you want faster onboarding and don’t mind some abstraction

---

## 12. Suggested domain model types

```ts
export type BeaconStatus = 'draft' | 'saved' | 'archived';

export type MatchType = 'same_topic' | 'adjacent_angle' | 'can_help';

export interface Beacon {
  id: string;
  userId: string;
  title: string;
  summary: string;
  exploring: string;
  helpWanted: string;
  tags: string[];
  sourceLlm?: string;
  status: BeaconStatus;
  isMatchable: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 13. API contract examples

## 13.1 Create Beacon

`POST /api/beacons`

```json
{
  "title": "Psychedelics and microtubule dynamics",
  "summary": "Exploring whether psychedelics could affect microtubule behavior directly or indirectly.",
  "exploring": "mechanistic plausibility, literature, experimental directions",
  "helpWanted": "cell biology expertise, counterarguments, relevant papers",
  "tags": ["psychedelics", "neuroscience", "microtubules"],
  "sourceLlm": "chatgpt",
  "isMatchable": true
}
```

## 13.2 MCP tool output

```json
{
  "draftId": "bcn_123",
  "title": "Psychedelics and microtubule dynamics",
  "summary": "Exploring whether psychedelics could affect microtubule behavior directly or indirectly.",
  "exploring": "mechanistic plausibility, literature, experimental directions",
  "helpWanted": "cell biology expertise, counterarguments, relevant papers",
  "tags": ["psychedelics", "neuroscience", "microtubules"],
  "reviewUrl": "https://app.usebeacon.ai/beacons/bcn_123/review"
}
```

## 13.3 Get related Beacons

`GET /api/beacons/:id/related`

Response:

```json
[
  {
    "beaconId": "bcn_456",
    "matchType": "can_help",
    "score": 0.84,
    "reason": "Explores a closely related topic with stronger experimental grounding."
  }
]
```

---

## 14. Matching algorithm details (MVP)

## Candidate generation

Canonical text for embedding:

```text
Title: <title>
Summary: <summary>
Exploring: <exploring>
Help wanted: <helpWanted>
Tags: <tags>
```

### Retrieve top K

* cosine similarity on vector index
* K = 20 to 50

## Scoring formula

For MVP:

```text
score =
  0.65 * semantic_similarity
+ 0.15 * tag_overlap
+ 0.15 * help_complementarity
+ 0.05 * recency_bonus
```

### Match type labeling

Simple rules:

* if semantic similarity high and overlap high -> `same_topic`
* if similarity moderate but tags adjacent -> `adjacent_angle`
* if one Beacon’s `helpWanted` aligns with the other’s `exploring` -> `can_help`

This can be heuristic at first.

---

## 15. Admin and ops tooling

You will want a small admin panel even in MVP.

Admin capabilities:

* view all Beacons
* inspect matches generated for a Beacon
* regenerate matches
* disable abusive users
* manually create / delete intro requests
* inspect MCP tool call failures

This can be a protected `/admin` route in the web app.

---

## 16. Observability

Minimum observability stack:

* **Vercel logs** for web app
* **CloudWatch logs** for MCP server
* **Sentry** for frontend + backend exceptions
* simple analytics via PostHog or Amplitude

Track these events:

* Beacon created
* Beacon set matchable
* related Beacon viewed
* intro requested
* intro accepted
* second Beacon created

These are more important than vanity traffic metrics.

---

## 17. Security and abuse considerations

For MVP, keep it pragmatic.

### Controls

* rate limit Beacon creation and intro requests
* basic auth checks on all resources
* no public index of private Beacons
* block / dismiss functionality for intro requests
* audit log for sensitive actions

### Secrets management

* Vercel env vars for web app
* AWS Secrets Manager for MCP server

---

## 18. Rollout plan

## Phase 1: core app

Build:

* auth
* manual Beacon creation
* Beacon dashboard
* detail pages
* isMatchable toggle
* basic related Beacon retrieval

## Phase 2: MCP capture

Build:

* MCP server
* `create_beacon_from_context`
* draft review flow
* save to web app

## Phase 3: intros

Build:

* intro request flow
* notifications
* accept/decline
* simple thread or email handoff

## Phase 4: improve match quality

Build:

* LLM-generated reasons
* reranking
* admin match review tools

---

## 19. Why this architecture is the right MVP architecture

This setup is good because it:

* keeps the frontend stack simple and founder-friendly
* uses Vercel where it shines
* uses AWS credits where it adds leverage
* avoids premature microservices
* isolates the MCP integration surface cleanly
* gives a straightforward path to production MVP

In practical terms:

* **Next.js on Vercel** is the right frontend and main app platform
* **Postgres + pgvector** is enough for storage and retrieval
* **MCP server on ECS Fargate** is a good use of AWS credits
* **Inngest + email provider** is enough for background jobs and notifications

---

## 20. Final recommendation

If building Beacon MVP today, I would choose:

* **Frontend + app backend:** Next.js on Vercel
* **DB:** Neon Postgres with pgvector
* **MCP server:** Node/TypeScript service on AWS ECS Fargate
* **Background jobs:** Inngest
* **Email:** Resend
* **ORM:** Drizzle or Prisma
* **Observability:** Sentry + PostHog

This is the fastest path to a functional product that still leaves room for Beacon to grow into a much larger system later.
