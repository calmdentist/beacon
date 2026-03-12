CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio text,
  interests text[],
  timezone text,
  matching_enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS beacons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text NOT NULL,
  exploring text NOT NULL,
  help_wanted text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  source_llm text,
  source_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft',
  is_matchable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beacons_user_id_idx ON beacons(user_id);
CREATE INDEX IF NOT EXISTS beacons_status_idx ON beacons(status);
CREATE INDEX IF NOT EXISTS beacons_matchable_idx ON beacons(is_matchable);

CREATE TABLE IF NOT EXISTS beacon_embeddings (
  beacon_id uuid PRIMARY KEY REFERENCES beacons(id) ON DELETE CASCADE,
  embedding vector(1536),
  embedding_model text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beacon_embeddings_vector_idx
ON beacon_embeddings
USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id uuid NOT NULL REFERENCES beacons(id) ON DELETE CASCADE,
  matched_beacon_id uuid NOT NULL REFERENCES beacons(id) ON DELETE CASCADE,
  match_type text NOT NULL,
  score numeric(4,3) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_beacon_id_idx ON matches(beacon_id);
CREATE INDEX IF NOT EXISTS matches_matched_beacon_id_idx ON matches(matched_beacon_id);

CREATE TABLE IF NOT EXISTS intro_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_beacon_id uuid NOT NULL REFERENCES beacons(id) ON DELETE CASCADE,
  to_beacon_id uuid NOT NULL REFERENCES beacons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intro_requests_from_user_idx ON intro_requests(from_user_id);
CREATE INDEX IF NOT EXISTS intro_requests_to_user_idx ON intro_requests(to_user_id);

CREATE TABLE IF NOT EXISTS intro_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intro_request_id uuid NOT NULL REFERENCES intro_requests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intro_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES intro_threads(id) ON DELETE CASCADE,
  sender_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intro_messages_thread_idx ON intro_messages(thread_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_action_idx ON audit_logs(user_id, action);
