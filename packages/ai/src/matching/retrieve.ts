import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

import type { MatchCandidate } from './types';

const DEFAULT_RETRIEVAL_LIMIT = 40;
const MAX_RETRIEVAL_LIMIT = 200;

interface RetrievalQueryResult {
  rows?: unknown[];
}

interface RetrievalRow {
  beacon_id: string;
  title: string;
  summary: string;
  exploring: string;
  created_at: Date | string;
  semantic_similarity: number | string;
  tag_overlap: number | string;
}

export interface PgvectorCandidateRetriever {
  execute: (query: SQL<unknown>) => Promise<unknown>;
}

export interface RetrievePgvectorCandidatesInput {
  beaconId: string;
  userId: string;
  embedding: number[];
  helpWanted: string;
  tags: string[];
  limit?: number;
}

export async function retrievePgvectorCandidates(
  db: PgvectorCandidateRetriever,
  input: RetrievePgvectorCandidatesInput
): Promise<MatchCandidate[]> {
  if (input.embedding.length === 0) {
    return [];
  }

  const result = await db.execute(buildPgvectorCandidateQuery(input));
  const rows = extractRows(result)
    .map(safeNormalizeRow)
    .filter((row): row is RetrievalRow => row !== null);

  return rows.map((row) => ({
    beaconId: row.beacon_id,
    semanticSimilarity: clamp01(toFiniteNumber(row.semantic_similarity)),
    tagOverlap: clamp01(toFiniteNumber(row.tag_overlap)),
    helpComplementarity: helpAlignment(input.helpWanted, row.exploring),
    recencyBonus: recencyBonus(row.created_at),
    createdAt: toIsoString(row.created_at),
    title: row.title,
    summary: row.summary
  }));
}

export function buildPgvectorCandidateQuery(input: RetrievePgvectorCandidatesInput): SQL<unknown> {
  const vectorLiteral = toVectorLiteral(input.embedding);
  const normalizedTags = normalizeTags(input.tags);
  const limit = clampInt(input.limit ?? DEFAULT_RETRIEVAL_LIMIT, 1, MAX_RETRIEVAL_LIMIT);

  return sql`
    SELECT
      b.id::text AS beacon_id,
      b.title,
      b.summary,
      b.exploring,
      b.created_at,
      GREATEST(0, LEAST(1, 1 - (be.embedding <=> ${vectorLiteral}::vector))) AS semantic_similarity,
      CASE
        WHEN GREATEST(cardinality(${normalizedTags}::text[]), cardinality(b.tags)) = 0 THEN 0
        ELSE (
          SELECT COUNT(*)
          FROM (
            SELECT DISTINCT lower(tag) AS normalized_tag
            FROM unnest(b.tags) AS tag
            WHERE lower(tag) = ANY(${normalizedTags}::text[])
          ) AS shared
        )::float / GREATEST(cardinality(${normalizedTags}::text[]), cardinality(b.tags))
      END AS tag_overlap
    FROM beacon_embeddings be
    JOIN beacons b ON b.id = be.beacon_id
    WHERE b.id <> ${input.beaconId}
      AND b.user_id <> ${input.userId}
      AND b.status = 'saved'
      AND b.is_matchable = true
      AND be.embedding IS NOT NULL
    ORDER BY be.embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;
}

function extractRows(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as RetrievalQueryResult).rows;
    if (Array.isArray(rows)) {
      return rows;
    }
  }

  return [];
}

function safeNormalizeRow(value: unknown): RetrievalRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Partial<RetrievalRow>;
  const beaconId = String(row.beacon_id ?? '');

  if (!beaconId) {
    return null;
  }

  return {
    beacon_id: beaconId,
    title: String(row.title ?? ''),
    summary: String(row.summary ?? ''),
    exploring: String(row.exploring ?? ''),
    created_at: row.created_at ?? new Date().toISOString(),
    semantic_similarity: row.semantic_similarity ?? 0,
    tag_overlap: row.tag_overlap ?? 0
  };
}

function normalizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);

  return Array.from(new Set(cleaned));
}

function toVectorLiteral(vector: number[]): string {
  const cleaned = vector.map((value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Number(value.toFixed(8));
  });

  return `[${cleaned.join(',')}]`;
}

function helpAlignment(helpWanted: string, exploring: string): number {
  const wanted = tokenize(helpWanted);
  const explored = tokenize(exploring);

  if (wanted.size === 0 || explored.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of wanted) {
    if (explored.has(token)) {
      shared += 1;
    }
  }

  return clamp01(shared / Math.max(wanted.size, explored.size));
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );
}

function recencyBonus(createdAt: Date | string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  return clamp01(1 - ageDays / 30);
}

function toIsoString(value: Date | string): string {
  return new Date(value).toISOString();
}

function toFiniteNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.floor(value);
  return Math.min(max, Math.max(min, rounded));
}
