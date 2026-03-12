import {
  createBeaconInputSchema,
  createIntroRequestInputSchema,
  introRequestSchema,
  matchSchema,
  relatedBeaconResponseSchema,
  type Beacon,
  type CreateBeaconInput,
  type IntroRequest,
  type Match,
  type RelatedBeaconResponse,
  updateBeaconInputSchema
} from '@beacon/core';
import { getDb, schema } from '@beacon/db';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

import { refreshPersistedMatchesForBeacon } from './matching';

type BeaconRow = typeof schema.beacons.$inferSelect;
type MatchRow = typeof schema.matches.$inferSelect;
type IntroRequestRow = typeof schema.introRequests.$inferSelect;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listBeaconsForUser(userId: string): Promise<Beacon[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.beacons)
    .where(eq(schema.beacons.userId, userId))
    .orderBy(desc(schema.beacons.createdAt));

  return rows.map(mapBeaconRow);
}

export async function getBeaconForUser(userId: string, beaconId: string): Promise<Beacon | null> {
  if (!isUuid(beaconId)) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .select()
    .from(schema.beacons)
    .where(and(eq(schema.beacons.userId, userId), eq(schema.beacons.id, beaconId)))
    .limit(1);

  if (!row) {
    return null;
  }

  return mapBeaconRow(row);
}

export async function createBeaconForUser(userId: string, input: unknown): Promise<Beacon> {
  const payload = createBeaconInputSchema.parse(input);
  const db = getDb();

  const [row] = await db
    .insert(schema.beacons)
    .values({
      userId,
      title: payload.title,
      summary: payload.summary,
      exploring: payload.exploring,
      helpWanted: payload.helpWanted,
      tags: payload.tags,
      sourceLlm: payload.sourceLlm,
      sourceType: payload.sourceType,
      status: payload.status,
      isMatchable: payload.isMatchable
    })
    .returning();

  const beacon = mapBeaconRow(row);
  if (beacon.isMatchable && beacon.status === 'saved') {
    await refreshPersistedMatchesForBeacon(beacon);
  }

  return beacon;
}

export async function updateBeaconForUser(userId: string, beaconId: string, input: unknown): Promise<Beacon | null> {
  const payload = updateBeaconInputSchema.parse(input);

  if (!isUuid(beaconId)) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .update(schema.beacons)
    .set({
      ...normalizePatch(payload),
      updatedAt: new Date()
    })
    .where(and(eq(schema.beacons.userId, userId), eq(schema.beacons.id, beaconId)))
    .returning();

  if (!row) {
    return null;
  }

  const beacon = mapBeaconRow(row);

  if (!row.isMatchable || row.status !== 'saved') {
    await deleteMatchesForBeacon(row.id);
    return beacon;
  }

  await refreshPersistedMatchesForBeacon(beacon);
  return beacon;
}

export async function setBeaconMatchingForUser(
  userId: string,
  beaconId: string,
  isMatchable: boolean
): Promise<Beacon | null> {
  if (!isUuid(beaconId)) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .update(schema.beacons)
    .set({
      isMatchable,
      updatedAt: new Date()
    })
    .where(and(eq(schema.beacons.userId, userId), eq(schema.beacons.id, beaconId)))
    .returning();

  if (!row) {
    return null;
  }

  const beacon = mapBeaconRow(row);

  if (!isMatchable || row.status !== 'saved') {
    await deleteMatchesForBeacon(row.id);
    return beacon;
  }

  await refreshPersistedMatchesForBeacon(beacon);
  return beacon;
}

export async function getRelatedForBeacon(userId: string, beaconId: string): Promise<RelatedBeaconResponse> {
  if (!isUuid(beaconId)) {
    return [];
  }

  const beacon = await getBeaconForUser(userId, beaconId);

  if (!beacon || !beacon.isMatchable) {
    return [];
  }

  const db = getDb();

  const rows = await db
    .select()
    .from(schema.matches)
    .where(or(eq(schema.matches.beaconId, beaconId), eq(schema.matches.matchedBeaconId, beaconId)))
    .orderBy(desc(schema.matches.score), desc(schema.matches.createdAt));

  const mapped = rows.map((row) => ({
    beaconId: row.beaconId === beaconId ? row.matchedBeaconId : row.beaconId,
    matchType: row.matchType,
    score: toNumber(row.score),
    reason: row.reason
  }));

  return relatedBeaconResponseSchema.parse(mapped);
}

export async function listMatchesForUser(userId: string): Promise<Match[]> {
  const db = getDb();

  const userBeaconRows = await db
    .select({ id: schema.beacons.id })
    .from(schema.beacons)
    .where(eq(schema.beacons.userId, userId));

  if (userBeaconRows.length === 0) {
    return [];
  }

  const beaconIds = userBeaconRows.map((row) => row.id);

  const rows = await db
    .select()
    .from(schema.matches)
    .where(or(inArray(schema.matches.beaconId, beaconIds), inArray(schema.matches.matchedBeaconId, beaconIds)))
    .orderBy(desc(schema.matches.score), desc(schema.matches.createdAt));

  return rows.map(mapMatchRow);
}

export async function createIntroRequestForUser(
  userId: string,
  input: unknown
): Promise<IntroRequest> {
  const payload = createIntroRequestInputSchema.parse(input);

  if (!isUuid(payload.fromBeaconId) || !isUuid(payload.toBeaconId)) {
    throw new Error('invalid_beacon_id');
  }

  const db = getDb();

  const [fromBeacon, toBeacon] = await Promise.all([
    db
      .select({ id: schema.beacons.id, userId: schema.beacons.userId })
      .from(schema.beacons)
      .where(eq(schema.beacons.id, payload.fromBeaconId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: schema.beacons.id, userId: schema.beacons.userId })
      .from(schema.beacons)
      .where(eq(schema.beacons.id, payload.toBeaconId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  ]);

  if (!fromBeacon || fromBeacon.userId !== userId) {
    throw new Error('from_beacon_not_found');
  }

  if (!toBeacon) {
    throw new Error('to_beacon_not_found');
  }

  if (payload.toUserId !== toBeacon.userId) {
    throw new Error('to_user_mismatch');
  }

  const [row] = await db
    .insert(schema.introRequests)
    .values({
      fromUserId: userId,
      toUserId: payload.toUserId,
      fromBeaconId: payload.fromBeaconId,
      toBeaconId: payload.toBeaconId,
      status: 'pending'
    })
    .returning();

  return mapIntroRequestRow(row);
}

export async function listIntrosForUser(userId: string): Promise<IntroRequest[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.introRequests)
    .where(or(eq(schema.introRequests.fromUserId, userId), eq(schema.introRequests.toUserId, userId)))
    .orderBy(desc(schema.introRequests.createdAt));

  return rows.map(mapIntroRequestRow);
}

export async function acceptIntroRequestForUser(
  userId: string,
  introRequestId: string
): Promise<IntroRequest | null> {
  if (!isUuid(introRequestId)) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .update(schema.introRequests)
    .set({ status: 'accepted' })
    .where(and(eq(schema.introRequests.id, introRequestId), eq(schema.introRequests.toUserId, userId)))
    .returning();

  if (!row) {
    return null;
  }

  return mapIntroRequestRow(row);
}

async function deleteMatchesForBeacon(beaconId: string): Promise<void> {
  const db = getDb();

  await db
    .delete(schema.matches)
    .where(or(eq(schema.matches.beaconId, beaconId), eq(schema.matches.matchedBeaconId, beaconId)));
}

function mapBeaconRow(row: BeaconRow): Beacon {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    summary: row.summary,
    exploring: row.exploring,
    helpWanted: row.helpWanted,
    tags: row.tags,
    sourceLlm: row.sourceLlm ?? undefined,
    sourceType: row.sourceType as Beacon['sourceType'],
    status: row.status as Beacon['status'],
    isMatchable: row.isMatchable,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapMatchRow(row: MatchRow): Match {
  return matchSchema.parse({
    id: row.id,
    beaconId: row.beaconId,
    matchedBeaconId: row.matchedBeaconId,
    matchType: row.matchType,
    score: toNumber(row.score),
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  });
}

function mapIntroRequestRow(row: IntroRequestRow): IntroRequest {
  return introRequestSchema.parse({
    id: row.id,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    fromBeaconId: row.fromBeaconId,
    toBeaconId: row.toBeaconId,
    status: row.status,
    createdAt: row.createdAt.toISOString()
  });
}

function normalizePatch(input: Partial<CreateBeaconInput>) {
  return {
    title: input.title,
    summary: input.summary,
    exploring: input.exploring,
    helpWanted: input.helpWanted,
    tags: input.tags,
    sourceLlm: input.sourceLlm,
    sourceType: input.sourceType,
    status: input.status,
    isMatchable: input.isMatchable
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
