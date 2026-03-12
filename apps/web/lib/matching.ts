import type { Beacon, Match, MatchStatus, MatchType, RelatedBeaconResponse } from '@beacon/core';
import { matchStatusSchema, matchTypeSchema } from '@beacon/core';
import {
  generateBeaconEmbedding,
  retrievePgvectorCandidates,
  scoreCandidates
} from '@beacon/ai';
import { getDb, schema } from '@beacon/db';
import { and, desc, eq } from 'drizzle-orm';

const MIN_PERSISTED_MATCHES = 3;
const MAX_PERSISTED_MATCHES = 5;
const CANDIDATE_RETRIEVAL_LIMIT = 40;

export async function refreshPersistedMatchesForBeacon(beacon: Beacon): Promise<boolean> {
  if (!beacon.isMatchable || beacon.status !== 'saved') {
    return clearPersistedMatchesForBeacon(beacon.id);
  }

  try {
    const db = getDb();
    const [anchor] = await db
      .select({ id: schema.beacons.id })
      .from(schema.beacons)
      .where(eq(schema.beacons.id, beacon.id))
      .limit(1);

    if (!anchor) {
      return false;
    }

    const embedding = await resolveAnchorEmbedding(beacon);
    if (!embedding) {
      return false;
    }

    const candidates = await retrievePgvectorCandidates(db, {
      beaconId: beacon.id,
      userId: beacon.userId,
      embedding,
      helpWanted: beacon.helpWanted,
      tags: beacon.tags,
      limit: CANDIDATE_RETRIEVAL_LIMIT
    });

    const scored = scoreCandidates(candidates, { limit: MAX_PERSISTED_MATCHES });
    const persistedCount = Math.min(MAX_PERSISTED_MATCHES, Math.max(MIN_PERSISTED_MATCHES, scored.length));
    const topMatches = scored.slice(0, persistedCount);

    await db.transaction(async (tx) => {
      await tx.delete(schema.matches).where(eq(schema.matches.beaconId, beacon.id));

      if (topMatches.length === 0) {
        return;
      }

      await tx.insert(schema.matches).values(
        topMatches.map((match) => ({
          beaconId: beacon.id,
          matchedBeaconId: match.beaconId,
          matchType: match.matchType,
          score: match.score.toFixed(3),
          reason: match.reason,
          status: 'suggested' satisfies MatchStatus
        }))
      );
    });

    return true;
  } catch (error) {
    console.warn('Failed to refresh persisted matches for beacon.', error);
    return false;
  }
}

export async function clearPersistedMatchesForBeacon(beaconId: string): Promise<boolean> {
  try {
    const db = getDb();
    await db.delete(schema.matches).where(eq(schema.matches.beaconId, beaconId));
    return true;
  } catch (error) {
    console.warn('Failed to clear persisted matches for beacon.', error);
    return false;
  }
}

export async function getPersistedRelatedForBeacon(
  userId: string,
  beaconId: string
): Promise<RelatedBeaconResponse | null> {
  try {
    const db = getDb();
    const [anchor] = await db
      .select({
        id: schema.beacons.id,
        isMatchable: schema.beacons.isMatchable
      })
      .from(schema.beacons)
      .where(and(eq(schema.beacons.id, beaconId), eq(schema.beacons.userId, userId)))
      .limit(1);

    if (!anchor) {
      return null;
    }

    if (!anchor.isMatchable) {
      return [];
    }

    const rows = await db
      .select({
        beaconId: schema.matches.matchedBeaconId,
        matchType: schema.matches.matchType,
        score: schema.matches.score,
        reason: schema.matches.reason
      })
      .from(schema.matches)
      .where(eq(schema.matches.beaconId, beaconId))
      .orderBy(desc(schema.matches.score))
      .limit(MAX_PERSISTED_MATCHES);

    return rows.map((row) => ({
      beaconId: row.beaconId,
      matchType: normalizeMatchType(row.matchType),
      score: normalizeScore(row.score),
      reason: row.reason
    }));
  } catch (error) {
    console.warn('Failed to load persisted related matches.', error);
    return null;
  }
}

export async function listPersistedMatchesForUser(userId: string): Promise<Match[] | null> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.matches.id,
        beaconId: schema.matches.beaconId,
        matchedBeaconId: schema.matches.matchedBeaconId,
        matchType: schema.matches.matchType,
        score: schema.matches.score,
        reason: schema.matches.reason,
        status: schema.matches.status,
        createdAt: schema.matches.createdAt
      })
      .from(schema.matches)
      .innerJoin(schema.beacons, eq(schema.beacons.id, schema.matches.beaconId))
      .where(eq(schema.beacons.userId, userId))
      .orderBy(desc(schema.matches.createdAt));

    return rows.map((row) => ({
      id: row.id,
      beaconId: row.beaconId,
      matchedBeaconId: row.matchedBeaconId,
      matchType: normalizeMatchType(row.matchType),
      score: normalizeScore(row.score),
      reason: row.reason,
      status: normalizeMatchStatus(row.status),
      createdAt: row.createdAt.toISOString()
    }));
  } catch (error) {
    console.warn('Failed to load persisted matches.', error);
    return null;
  }
}

async function resolveAnchorEmbedding(beacon: Beacon): Promise<number[] | null> {
  const generated = await generateBeaconEmbedding({
    title: beacon.title,
    summary: beacon.summary,
    exploring: beacon.exploring,
    helpWanted: beacon.helpWanted,
    tags: beacon.tags
  });

  const db = getDb();

  if (generated) {
    await db
      .insert(schema.beaconEmbeddings)
      .values({
        beaconId: beacon.id,
        embedding: generated.embedding,
        embeddingModel: generated.model,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: schema.beaconEmbeddings.beaconId,
        set: {
          embedding: generated.embedding,
          embeddingModel: generated.model,
          updatedAt: new Date()
        }
      });

    return generated.embedding;
  }

  const [existing] = await db
    .select({ embedding: schema.beaconEmbeddings.embedding })
    .from(schema.beaconEmbeddings)
    .where(eq(schema.beaconEmbeddings.beaconId, beacon.id))
    .limit(1);

  return parseEmbeddingVector(existing?.embedding);
}

function parseEmbeddingVector(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const vector = value
      .map((item) => (typeof item === 'number' ? item : Number(item)))
      .filter((item) => Number.isFinite(item));
    return vector.length > 0 ? vector : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const vector = trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));

  return vector.length > 0 ? vector : null;
}

function normalizeMatchType(value: string): MatchType {
  const parsed = matchTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : 'adjacent_angle';
}

function normalizeMatchStatus(value: string): MatchStatus {
  const parsed = matchStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'suggested';
}

function normalizeScore(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}
