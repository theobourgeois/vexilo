import { Flag } from "@/lib/types";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

export const createTable = pgTableCreator((name) => `vexilo_${name}`);

export const users = createTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  isAdmin: boolean("is_admin").notNull().default(false),
  name: varchar("name", { length: 255 }),
  userNumber: uuid("user_number").defaultRandom().notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    precision: 3,
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  image: varchar("image", { length: 255 }),
  hashedPassword: text("hashed_password"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accounts = createTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_user_id_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const flags = createTable("flag", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  image: varchar("image", { length: 1000 }).notNull(),
  link: varchar("link", { length: 1000 }).notNull(),
  index: integer("index").notNull(),
  tags: text("tags").array().notNull().default([]),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  favorites: integer("favorites").notNull().default(0),
}, (table) => ({
  indexUnique: uniqueIndex("index_unique").on(table.index),
}));

export const flagRequests = createTable("flag_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  oldFlag: jsonb("old_flag").$type<Omit<Flag, "id">>(),
  approved: boolean("approved").notNull().default(false),
  flag: jsonb("flag").$type<Omit<Flag, "id">>().notNull(),
  flagId: varchar("flag_id", { length: 255 }),
  isEdit: boolean("is_edit").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const bannedUsers = createTable("banned_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  reason: varchar("reason", { length: 255 }).notNull().default(""),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const flagOfTheDay = createTable("flag_of_the_day", {
  id: uuid("id").primaryKey().defaultRandom(),
  flagId: uuid("flag_id")
    .notNull()
    .references(() => flags.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});


export const leaderboard = createTable("leaderboard", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  contributions: integer("contributions").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const favorites = createTable("favorite", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  flagId: uuid("flag_id")
    .notNull()
    .references(() => flags.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  flag: one(flags, { fields: [favorites.flagId], references: [flags.id] }),
}));