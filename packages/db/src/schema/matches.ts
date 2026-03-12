import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { beacons } from './beacons';

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    beaconId: uuid('beacon_id')
      .notNull()
      .references(() => beacons.id, { onDelete: 'cascade' }),
    matchedBeaconId: uuid('matched_beacon_id')
      .notNull()
      .references(() => beacons.id, { onDelete: 'cascade' }),
    matchType: text('match_type').notNull(),
    score: numeric('score', { precision: 4, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('suggested'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    beaconIdIdx: index('matches_beacon_id_idx').on(table.beaconId),
    matchedBeaconIdIdx: index('matches_matched_beacon_id_idx').on(table.matchedBeaconId)
  })
);
