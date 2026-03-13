# Manifold Memory Architecture

## 1. Overview

### Objective

Build a hybrid memory system for agents that combines:

1. **Episodic memory** for exact traces and provenance
2. **Symbolic memory** for inspectable facts, preferences, entities, and rules
3. **Manifold memory** for compact latent state objects that capture reusable semantic structure across many episodes

The system should let an agent do more than retrieve past text. It should let the agent **re-enter the right internal state** for a user, task, role, or project.

### Core thesis

A good memory system is not just a storage system. It is a **write–manage–read control loop** over multiple representational substrates.

The manifold layer is the compression and rehydration substrate:

* compress repeated experiences into reusable latent objects
* generalize across paraphrases and adjacent tasks
* reinstate task-relevant internal state at inference time
* support consolidation, decay, splitting, and merging over time

### Non-goals

This architecture does **not** assume that latent memory replaces:

* exact auditability
* symbolic rules and facts
* explicit approval/policy systems
* external retrieval over documents

It is a hybrid system.

---

## 2. System Requirements

### Functional requirements

* Persist long-horizon agent state across sessions
* Improve personalization and preference retention
* Reduce repeated mistakes
* Compress many episodes into compact reusable memory objects
* Support provenance and debugability
* Work with one or more base LLMs
* Allow selective forgetting and decay
* Support role-specific memory for multi-agent systems

### Quality requirements

* Low-latency online read path
* Bounded write amplification
* Interpretable symbolic layer
* Measurable gains over retrieval-only baselines
* Safe fallback when manifold retrieval is low-confidence
* Model-provider portability where possible

---

## 3. High-Level Architecture

```text
User / Environment
    |
    v
Agent Runtime
    |
    +--> Episode Capture Service
    |         |
    |         v
    |    Episodic Store
    |
    +--> Memory Compiler
    |         |
    |         +--> Symbolic Extractor --> Symbolic Store
    |         |
    |         +--> Latent Checkpoint Extractor --> Latent Trace Store
    |
    +--> Consolidation Pipeline
    |         |
    |         +--> Concept Clustering
    |         +--> Manifold Builder
    |         +--> Split/Merge/Decay Engine
    |         v
    |    Manifold Store
    |
    +--> Read/Query Orchestrator
              |
              +--> Symbolic Retriever
              +--> Episodic Retriever
              +--> Manifold Retriever
              |
              v
         State Rehydration Engine
              |
              +--> Memory Tokens / Prefixes
              +--> KV Warm Start
              +--> Activation Steering
              +--> Adapter Routing
              |
              v
         Base LLM Inference
```

---

## 4. Core Abstractions

### 4.1 Episode

An atomic logged experience.

```json
{
  "episode_id": "ep_123",
  "agent_id": "agent_alpha",
  "user_id": "user_42",
  "project_id": "proj_9",
  "role": "coding_agent",
  "timestamp": "2026-03-13T17:20:00Z",
  "input": {...},
  "retrieved_context": [...],
  "tool_calls": [...],
  "outputs": [...],
  "environment_result": {...},
  "reward": 0.84,
  "human_feedback": {...},
  "trace_ptrs": {...}
}
```

### 4.2 Symbolic Memory Item

Explicit, inspectable memory.

```json
{
  "memory_id": "sym_001",
  "type": "preference",
  "scope": {
    "user_id": "user_42",
    "project_id": null,
    "agent_id": null
  },
  "key": "response_style",
  "value": {
    "preferred": ["concise", "decisive", "venture_framed"]
  },
  "confidence": 0.93,
  "provenance": ["ep_101", "ep_117", "ep_123"],
  "created_at": "...",
  "updated_at": "...",
  "ttl": null
}
```

### 4.3 Latent Trace

A checkpointed latent representation from an episode.

```json
{
  "trace_id": "lt_882",
  "episode_id": "ep_123",
  "checkpoint_type": "pre_tool_decision",
  "layer_range": [18, 24],
  "state_ref": "s3://bucket/latent/lt_882.bin",
  "anchors": ["coding", "repo_style", "small_pr_bias"],
  "reward": 0.84
}
```

### 4.4 Manifold Memory Object

A compact latent concept/state object.

```json
{
  "memory_id": "mm_021",
  "scope": {
    "user_id": "user_42",
    "project_id": "proj_9",
    "agent_role": "coding_agent"
  },
  "anchors": ["small_prs", "avoid_auth_changes", "follow_repo_conventions"],
  "prototypes": ["z_a", "z_b", "z_c"],
  "local_basis_ref": "s3://bucket/basis/mm_021.npy",
  "density_stats": {
    "cov_ref": "s3://bucket/cov/mm_021.npy",
    "radius": 1.7
  },
  "sparse_features": [
    {"feature_id": "f_1192", "weight": 0.81},
    {"feature_id": "f_2921", "weight": 0.54}
  ],
  "decoder_hooks": {
    "memory_tokens": "mtok_021",
    "steering_adapter": "adapter_021"
  },
  "usage_stats": {
    "reads": 44,
    "writes": 12,
    "success_delta": 0.11
  },
  "confidence": 0.88,
  "provenance": ["ep_101", "ep_104", "ep_123"]
}
```

---

## 5. Modules

## 5.1 Episode Capture Service

### Responsibilities

* capture interaction traces from agent runtime
* normalize prompts, retrieved docs, tool calls, outputs
* mark key checkpoints for latent extraction
* attach outcome signals and human feedback

### Inputs

* runtime events from agent loop
* tool telemetry
* human feedback / eval signals

### Outputs

* immutable episode records
* checkpoint schedule for latent extraction

### API

#### `POST /v1/episodes`

Create an episode.

Request:

```json
{
  "agent_id": "agent_alpha",
  "user_id": "user_42",
  "project_id": "proj_9",
  "role": "coding_agent",
  "input": {...},
  "tool_calls": [...],
  "outputs": [...],
  "environment_result": {...},
  "reward": 0.84,
  "feedback": {...}
}
```

Response:

```json
{
  "episode_id": "ep_123",
  "status": "created"
}
```

---

## 5.2 Symbolic Extractor

### Responsibilities

* extract explicit facts, preferences, entities, constraints, task summaries
* canonicalize redundant memories
* estimate confidence and contradiction risk

### Extraction classes

* user preferences
* project conventions
* workflow constraints
* entity relationships
* task summaries
* failure patterns

### API

#### `POST /v1/symbolic/extract`

Request:

```json
{
  "episode_id": "ep_123",
  "scope": {
    "user_id": "user_42",
    "project_id": "proj_9"
  }
}
```

Response:

```json
{
  "items": [
    {
      "type": "preference",
      "key": "pr_style",
      "value": {"preferred": ["small", "incremental"]},
      "confidence": 0.92
    }
  ]
}
```

---

## 5.3 Latent Checkpoint Extractor

### Responsibilities

* capture selected hidden states or residual-stream snapshots
* compress layer/token states into checkpoint vectors
* optionally compute sparse feature activations
* attach symbolic anchors for later clustering

### Checkpoint types

* post-intent-understanding
* post-retrieval
* pre-tool-selection
* post-tool-result
* pre-final-response

### Design choices

* do not store all token states
* pool over selected tokens or positions
* support model-specific adapters for state extraction

### API

#### `POST /v1/latent/extract`

Request:

```json
{
  "episode_id": "ep_123",
  "checkpoints": [
    "post_intent_understanding",
    "pre_tool_decision",
    "pre_final_response"
  ],
  "layer_range": [18, 24],
  "pooling": "attention_weighted_mean"
}
```

Response:

```json
{
  "traces": [
    {"trace_id": "lt_881", "checkpoint_type": "post_intent_understanding"},
    {"trace_id": "lt_882", "checkpoint_type": "pre_tool_decision"}
  ]
}
```

---

## 5.4 Memory Compiler

### Responsibilities

* align symbolic and latent outputs
* attach scope metadata
* produce candidate memory updates
* route candidates to consolidation pipeline

### Output classes

* create new symbolic item
* update existing symbolic item
* create new manifold candidate
* update manifold candidate
* discard low-value signal

### API

#### `POST /v1/memory/compile`

Request:

```json
{
  "episode_id": "ep_123",
  "symbolic_items": [...],
  "latent_trace_ids": ["lt_881", "lt_882"]
}
```

Response:

```json
{
  "symbolic_actions": [...],
  "manifold_candidates": [...],
  "discarded": [...]
}
```

---

## 5.5 Consolidation Pipeline

### Responsibilities

* cluster related latent traces
* build manifold memory objects
* merge/split existing objects
* estimate confidence, recency, and utility
* decay stale or low-utility memories

### Submodules

#### 5.5.1 Concept Clustering

Groups traces by semantic neighborhood, scope, and outcome utility.

#### 5.5.2 Manifold Builder

Builds a local region representation from clustered traces.
Possible implementations:

* prototype set + PCA basis
* mixture of Gaussians
* low-rank tangent subspace
* autoencoder latent cell with neighborhood stats

#### 5.5.3 Split/Merge Engine

* split overloaded memories with multimodal structure
* merge near-duplicate memories with aligned anchors

#### 5.5.4 Decay/Retention Engine

* time decay
* utility-based retention
* pin protected or high-value memories

### API

#### `POST /v1/consolidate/run`

Request:

```json
{
  "scope": {
    "user_id": "user_42",
    "project_id": "proj_9",
    "agent_role": "coding_agent"
  },
  "mode": "incremental"
}
```

Response:

```json
{
  "created": ["mm_021"],
  "updated": ["mm_007", "mm_010"],
  "split": [{"old": "mm_002", "new": ["mm_030", "mm_031"]}],
  "merged": [{"old": ["mm_005", "mm_006"], "new": "mm_032"}]
}
```

---

## 5.6 Episodic Store

### Responsibilities

* immutable raw trace storage
* exact search and replay
* provenance source of truth

### Storage suggestions

* object store for raw transcripts + tool traces
* relational index for metadata
* optional columnar analytics store for evals

### API

#### `GET /v1/episodes/{episode_id}`

Return full episode.

#### `POST /v1/episodes/search`

Search by scope, task, anchors, or time.

---

## 5.7 Symbolic Store

### Responsibilities

* serve exact facts, preferences, constraints
* support contradiction detection and user-facing inspection

### API

#### `POST /v1/symbolic/query`

Request:

```json
{
  "scope": {
    "user_id": "user_42",
    "project_id": "proj_9"
  },
  "types": ["preference", "constraint", "project_convention"]
}
```

Response:

```json
{
  "items": [...]
}
```

#### `POST /v1/symbolic/upsert`

Upsert symbolic memory item.

#### `POST /v1/symbolic/forget`

Delete, expire, or mark disputed.

---

## 5.8 Manifold Store

### Responsibilities

* store compact manifold objects
* support nearest-region retrieval
* expose utility and provenance stats

### Retrieval signals

* anchor overlap
* prototype distance
* manifold fit score
* sparse-feature overlap
* scope compatibility
* recency and utility priors

### API

#### `POST /v1/manifold/query`

Request:

```json
{
  "scope": {
    "user_id": "user_42",
    "project_id": "proj_9",
    "agent_role": "coding_agent"
  },
  "query_state_ref": "qs_1001",
  "top_k": 5
}
```

Response:

```json
{
  "results": [
    {
      "memory_id": "mm_021",
      "score": 0.91,
      "fit": 0.84,
      "anchors": ["small_prs", "repo_conventions"]
    }
  ]
}
```

#### `GET /v1/manifold/{memory_id}`

Return memory object metadata.

#### `POST /v1/manifold/forget`

Soft delete, hard delete, or decay.

---

## 5.9 Read/Query Orchestrator

### Responsibilities

* construct query state from current task
* retrieve from episodic, symbolic, and manifold layers
* rank and assemble memory package for runtime

### Steps

1. compute query state from current prompt + runtime state
2. fetch relevant symbolic facts
3. fetch exact episodes when provenance matters
4. fetch top manifold objects
5. decide rehydration strategy
6. produce memory package for agent runtime

### API

#### `POST /v1/memory/read`

Request:

```json
{
  "scope": {
    "user_id": "user_42",
    "project_id": "proj_9",
    "agent_role": "coding_agent"
  },
  "task": {
    "input": "Review this PR and suggest minimal changes",
    "tool_context": {...}
  },
  "mode": "hybrid"
}
```

Response:

```json
{
  "symbolic": [...],
  "episodes": [...],
  "manifolds": [...],
  "rehydration_plan": {
    "method": "memory_tokens_plus_adapter",
    "objects": ["mm_021", "mm_010"]
  }
}
```

---

## 5.10 State Rehydration Engine

### Responsibilities

Convert manifold memory objects into runtime interventions.

### Supported rehydration methods

#### A. Memory tokens

Learned tokens representing a manifold object or mixture of objects.

#### B. Prefix / soft prompt injection

Inject learned continuous prefixes conditioned on manifold object.

#### C. KV warm-start

Seed selected attention layers with memory-derived KV states.

#### D. Activation steering

Apply layer-specific offsets or low-rank adapters derived from retrieved manifold objects.

#### E. Router conditioning

Condition mixture-of-experts or adapter routing based on memory state.

### Rehydration policy

Select method based on:

* model compatibility
* latency budget
* confidence
* task type
* risk setting

### API

#### `POST /v1/rehydrate`

Request:

```json
{
  "base_model": "gpt-x",
  "query_state_ref": "qs_1001",
  "manifold_ids": ["mm_021", "mm_010"],
  "method": "memory_tokens_plus_adapter"
}
```

Response:

```json
{
  "runtime_artifacts": {
    "memory_tokens_ref": "mt_771",
    "adapter_ref": "ad_455"
  },
  "confidence": 0.87
}
```

---

## 5.11 Policy + Safety Layer

### Responsibilities

* verify symbolic constraints
* gate dangerous rehydration or actions
* prevent low-confidence latent memory from overriding explicit facts

### Examples

* explicit user preference beats inferred latent style
* policy constraints override manifold-driven suggestions
* regulated domains require provenance-backed symbolic memory for factual claims

### API

#### `POST /v1/memory/verify`

Request:

```json
{
  "memory_package": {...},
  "policy_context": {...}
}
```

Response:

```json
{
  "approved": true,
  "masked": [],
  "warnings": ["latent_memory_low_confidence"]
}
```

---

## 5.12 Eval + Telemetry Layer

### Responsibilities

* measure read-path lift
* track memory utility
* detect harmful drift or collapse
* compare rehydration methods

### Key metrics

* task success delta vs no-memory baseline
* repeated mistake rate
* personalization win rate
* token savings
* retrieval precision/recall
* manifold utilization rate
* collapse score / overload score
* contradiction rate in symbolic memory

### API

#### `POST /v1/evals/run`

Run benchmark suite for a scope, agent class, or model.

---

## 6. Online Runtime Flow

### Step 1: incoming task

Agent runtime sends task context and scope.

### Step 2: query-state construction

A query-state encoder computes a compact state representation for the current task.

### Step 3: memory read

Read orchestrator fetches:

* relevant symbolic memory
* optional episodic exemplars
* matching manifold objects

### Step 4: verification

Policy layer checks conflicts and confidence.

### Step 5: rehydration

State rehydration engine prepares artifacts.

### Step 6: base inference

LLM runs with memory package.

### Step 7: action + outcome

Tool calls and outputs occur.

### Step 8: write-back

Episode is captured and memory compiler updates stores.

---

## 7. Offline Training Architecture

## 7.1 Training Targets

The training goal is not just reconstruction. The goal is **future utility**.
A memory object is good if using it improves later behavior.

### Training inputs

* historical episodes
* trace outcomes / rewards
* human preference labels
* task success / failure signals
* user corrections

### Training outputs

* query-state encoder
* manifold-builder parameters
* rehydration decoder components
* split/merge policy
* retention/decay policy

---

## 7.2 Training Losses

### A. Contrastive neighborhood loss

Pull together traces that should belong to the same reusable concept region and push apart irrelevant traces.

For anchor/query trace `q`, positive traces `P`, negative traces `N`:

```text
L_contrast = - log \frac{\sum_{p \in P} exp(sim(q,p)/tau)}{\sum_{p \in P} exp(sim(q,p)/tau) + \sum_{n \in N} exp(sim(q,n)/tau)}
```

Use cases:

* same user preference under different wording
* same repo convention across many coding episodes
* same task mode across sessions

### B. Next-task utility loss

Train memory retrieval + rehydration to improve future task performance.

```text
L_utility = CE(y_true, y_pred_with_memory) - \lambda * gain_over_baseline
```

Or optimize expected reward delta:

```text
L_reward = - E[R(task | memory)]
```

This is the most important loss class.

### C. Reconstruction / anchor prediction loss

A manifold object should predict key symbolic anchors or likely next actions.

```text
L_anchor = BCE(anchor_true, anchor_pred)
L_next_action = CE(a_true, a_pred)
```

### D. Prototype compactness + coverage loss

Encourage prototypes to cover the region without collapsing.

```text
L_cover = \sum_{x \in cluster} min_k ||x - z_k||^2
L_separate = - \sum_{i \neq j} ||z_i - z_j||^2
```

Combined:

```text
L_proto = L_cover + alpha * max(0, margin - separation)
```

### E. Tangent consistency / local geometry loss

Preserve local neighborhood structure under manifold encoding.

```text
L_geom = \sum_{(i,j) \in N} | d_enc(x_i, x_j) - d_raw(x_i, x_j) |
```

Or encourage accurate reconstruction from local basis.

### F. Anti-collapse entropy loss

Prevent all memories from becoming generic.

```text
L_entropy = - H(assignments)
```

Can also regularize slot utilization distribution.

### G. Write-gating loss

Train when to update a memory slot vs create a new one vs ignore the signal.

Targets can be supervised from hindsight utility or learned with RL/bandits.

```text
L_gate = CE(gate_decision_true, gate_decision_pred)
```

### H. Merge/Split decision loss

Train split/merge controller using offline labels derived from later outcomes.

```text
L_split_merge = CE(op_true, op_pred)
```

### I. Decay/retention loss

Learn memory retention from future usefulness.

```text
L_retain = BCE(useful_later, retain_prob)
```

### J. Rehydration alignment loss

A retrieved manifold object should induce a runtime state similar to successful historical states.

```text
L_rehydrate = || h_rehydrated - h_target_success ||^2
```

Or use behavioral alignment:

```text
L_behavior = KL(pi_with_memory || pi_target_success)
```

### K. Sparse feature consistency loss (optional)

If using SAE or sparse latent features, keep manifold objects aligned with stable sparse features.

```text
L_sparse = || s_pred - s_true ||_1 + beta * sparsity_penalty
```

---

## 7.3 Total Objective

A representative training objective:

```text
L_total =
  w1 * L_contrast +
  w2 * L_reward +
  w3 * L_anchor +
  w4 * L_proto +
  w5 * L_geom +
  w6 * L_entropy +
  w7 * L_gate +
  w8 * L_split_merge +
  w9 * L_retain +
  w10 * L_rehydrate +
  w11 * L_sparse
```

Tune weights by task family and deployment environment.

---

## 8. Model Interfaces

## 8.1 Base Model Adapter Interface

Allows memory system to support multiple LLM providers.

```python
class BaseModelAdapter:
    def extract_checkpoint_states(self, trace, checkpoints, layer_range):
        ...

    def build_query_state(self, prompt, tool_context, layer_range):
        ...

    def apply_memory_tokens(self, manifold_artifacts):
        ...

    def apply_adapter(self, adapter_ref):
        ...

    def apply_kv_warmstart(self, kv_ref):
        ...
```

## 8.2 Memory Runtime SDK

```python
memory = MemoryClient(api_key=...)

pkg = memory.read(
    user_id="user_42",
    project_id="proj_9",
    agent_role="coding_agent",
    task={"input": prompt, "tool_context": tool_ctx}
)

verified = memory.verify(pkg, policy_context=policy)
rehydrated = memory.rehydrate(model="gpt-x", package=verified)

response = llm.generate(
    prompt=prompt,
    memory_tokens=rehydrated.memory_tokens,
    adapter=rehydrated.adapter
)

memory.write_episode(
    agent_id="agent_alpha",
    user_id="user_42",
    project_id="proj_9",
    input=prompt,
    outputs=response,
    reward=score_response(response)
)
```

---

## 9. Storage Design

### Recommended stores

* **Episodic store:** object store + relational index
* **Symbolic store:** Postgres / document store
* **Latent trace store:** object store with vector index metadata
* **Manifold store:** relational metadata + binary artifact store
* **Eval telemetry:** OLAP store

### Indexes

* scope indexes: user/project/agent role
* time indexes
* anchor indexes
* latent prototype ANN index
* sparse feature inverted index

---

## 10. Multi-Agent Support

### Design

Each agent role gets:

* shared episodic store access (optional)
* shared symbolic memory with scope controls
* role-specific manifold memory

### Why

Two agents may read the same episode but need different state abstractions.
Example:

* planner agent stores strategy manifold
* executor agent stores tool-use manifold
* reviewer agent stores quality/style manifold

### API

#### `POST /v1/memory/share`

Share symbolic or episodic references across agents.

#### `POST /v1/manifold/project`

Project shared memories into a role-specific manifold space.

---

## 11. Forgetting and Memory Hygiene

### Forgetting modes

* soft decay
* hard delete
* dispute / quarantine
* overwrite with explicit user correction

### Rules

* explicit user correction beats inferred memory
* stale low-utility manifold objects decay faster
* memories with repeated conflict are split or quarantined

### API

#### `POST /v1/memory/forget`

Request:

```json
{
  "memory_id": "mm_021",
  "mode": "soft_decay",
  "reason": "user_corrected_preference"
}
```

---

## 12. Evaluation Plan

### Benchmark categories

1. **Preference retention**
2. **Repeated mistake reduction**
3. **Project style consistency**
4. **Long-horizon task completion**
5. **Compression vs performance tradeoff**
6. **Multi-agent specialization**
7. **Failure under stale/conflicting memory**

### Baselines

* no memory
* retrieval-only vector memory
* symbolic-only memory
* graph memory
* hybrid symbolic + episodic
* full hybrid with manifold memory

### Success criteria

* statistically significant task success lift
* lower token usage vs replay-heavy baselines
* lower repeated error rate
* stable performance under extended sessions

---

## 13. MVP Recommendation

### Initial wedge

Persistent coding agents.

### MVP modules

* episode capture
* symbolic extraction
* latent checkpoint extraction
* simple prototype-based manifold builder
* memory-token rehydration only
* offline eval harness

### Deferred items

* full split/merge controller
* SAE integration
* KV warm start
* multi-model portability
* complex multi-agent projection

---

## 14. Open Research Questions

* what is the best checkpointing scheme for utility vs storage cost?
* are manifold objects best modeled as prototypes + basis, mixture models, or learned memory cells?
* which rehydration method gives the best latency/performance tradeoff?
* how portable are manifold memories across base models?
* how much of user/project state can be represented latently without hurting auditability?
* can symbolic and latent memory be jointly trained so they align cleanly?

---

## 15. Practical Build Sequence

### Phase 1

* episode logging
* symbolic memory extraction
* offline latent checkpoint collection
* simple query-state encoder
* nearest-prototype retrieval

### Phase 2

* manifold consolidation
* memory-token rehydration
* utility-based eval loop
* retention/decay policies

### Phase 3

* split/merge controller
* sparse feature support
* activation steering / adapter routing
* multi-agent role-specific manifolds

---

## 16. Summary

Manifold memory should be treated as a **compressed semantic state layer** inside a broader hybrid memory architecture.

The end-to-end loop is:

1. capture episodes
2. extract symbolic facts + latent checkpoints
3. consolidate checkpoints into manifold memory objects
4. retrieve symbolic, episodic, and manifold memory at runtime
5. rehydrate the right latent state into the model
6. verify against explicit policy and facts
7. act, observe outcomes, and learn which memories were actually useful

This design gives a concrete path from the intuition that ideas live in activation space to a buildable system for persistent agent memory.
