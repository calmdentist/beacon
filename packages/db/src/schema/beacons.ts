import { index, pgTable, text, timestamp, uuid, vector, boolean } from 'drizzle-orm/pg-core';

import { users } from './users';

export const beacons = pgTable(
  'beacons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    exploring: text('exploring').notNull(),
    helpWanted: text('help_wanted').notNull(),
    tags: text('tags').array().notNull().default([]),
    sourceLlm: text('source_llm'),
    sourceType: text('source_type').notNull().default('manual'),
    status: text('status').notNull().default('draft'),
    isMatchable: boolean('is_matchable').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    userIdIdx: index('beacons_user_id_idx').on(table.userId),
    statusIdx: index('beacons_status_idx').on(table.status),
    matchableIdx: index('beacons_matchable_idx').on(table.isMatchable)
  })
);

export const beaconEmbeddings = pgTable(
  'beacon_embeddings',
  {
    beaconId: uuid('beacon_id')
      .primaryKey()
      .references(() => beacons.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', { dimensions: 1536 }),
    embeddingModel: text('embedding_model').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    embeddingIdx: index('beacon_embeddings_vector_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    )
  })
);
