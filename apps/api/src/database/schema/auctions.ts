import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { bids } from './bids';

export const auctionStatusEnum = pgEnum('auction_status', [
  'draft',
  'scheduled',
  'live',
  'ended',
  'cancelled',
]);

export const auctions = pgTable('auctions', {
  id: uuid().primaryKey().defaultRandom(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  startingPriceCents: integer().notNull(),
  currentPriceCents: integer().notNull(),
  bidIncrementCents: integer().notNull().default(100),
  status: auctionStatusEnum().notNull().default('draft'),
  startsAt: timestamp({ withTimezone: true }).notNull(),
  endsAt: timestamp({ withTimezone: true }).notNull(),
  sellerId: uuid().notNull().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  seller: one(users, { fields: [auctions.sellerId], references: [users.id] }),
  bids: many(bids),
}));

export type Auction = typeof auctions.$inferSelect;
export type NewAuction = typeof auctions.$inferInsert;
