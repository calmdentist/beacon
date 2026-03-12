import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { beacons } from './beacons';
import { users } from './users';

export const introRequests = pgTable(
  'intro_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fromUserId: text('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: text('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fromBeaconId: uuid('from_beacon_id')
      .notNull()
      .references(() => beacons.id, { onDelete: 'cascade' }),
    toBeaconId: uuid('to_beacon_id')
      .notNull()
      .references(() => beacons.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    fromUserIdx: index('intro_requests_from_user_idx').on(table.fromUserId),
    toUserIdx: index('intro_requests_to_user_idx').on(table.toUserId)
  })
);

export const introThreads = pgTable('intro_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  introRequestId: uuid('intro_request_id')
    .notNull()
    .references(() => introRequests.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const introMessages = pgTable(
  'intro_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => introThreads.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    threadIdx: index('intro_messages_thread_idx').on(table.threadId)
  })
);
