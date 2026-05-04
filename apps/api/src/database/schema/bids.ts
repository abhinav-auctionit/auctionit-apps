import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auctions } from './auctions';
import { users } from './users';

export const bids = pgTable(
  'bids',
  {
    id: uuid().primaryKey().defaultRandom(),
    auctionId: uuid().notNull().references(() => auctions.id, { onDelete: 'cascade' }),
    bidderId: uuid().notNull().references(() => users.id),
    amountCents: integer().notNull(),
    placedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    auctionIdx: index('bids_auction_idx').on(t.auctionId, t.placedAt.desc()),
    bidderIdx: index('bids_bidder_idx').on(t.bidderId),
  }),
);

export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, { fields: [bids.auctionId], references: [auctions.id] }),
  bidder: one(users, { fields: [bids.bidderId], references: [users.id] }),
}));

export type Bid = typeof bids.$inferSelect;
export type NewBid = typeof bids.$inferInsert;
