import { Flag } from '@/lib/types';
import type { EmblemPlacement, StudioDesign } from '@/lib/studio-design';
import { relations, sql } from 'drizzle-orm';
import {
  date,
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
  real,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { type AdapterAccount } from 'next-auth/adapters';

export const createTable = pgTableCreator((name) => `vexilo_${name}`);

export type FlagAiResearchSource = {
  type: 'llm' | 'web' | 'image' | 'manual';
  title?: string;
  url?: string;
  provider?: string;
  model?: string;
  notes?: string;
};

export type FlagAiColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'white'
  | 'black'
  | 'orange'
  | 'purple'
  | 'brown'
  | 'gold'
  | 'silver'
  | 'maroon'
  | 'light_blue';

export type FlagAiLayoutType =
  | 'solid'
  | 'horizontal_stripes'
  | 'vertical_stripes'
  | 'cross'
  | 'nordic_cross'
  | 'saltire'
  | 'centered_emblem'
  | 'canton'
  | 'diagonal'
  | 'triangle'
  | 'quartered'
  | 'complex';

export type FlagAiPatternType =
  | 'solid'
  | 'bicolor'
  | 'tricolor'
  | 'multistripe'
  | 'solid_with_center_symbol'
  | 'solid_with_canton'
  | 'cross_pattern'
  | 'diagonal_pattern'
  | 'quartered'
  | 'complex';

export type FlagAiSymbolType =
  | 'star'
  | 'cross'
  | 'circle'
  | 'sun'
  | 'moon'
  | 'triangle'
  | 'diamond'
  | 'animal'
  | 'plant'
  | 'weapon'
  | 'coat_of_arms'
  | 'seal'
  | 'text'
  | 'map'
  | 'building'
  | 'human'
  | 'crown'
  | 'ship'
  | 'tool'
  | 'constellation'
  | 'other';

export type FlagAiSymbolCount = 'none' | 'one' | 'few' | 'many';

export type FlagAiTextType =
  | 'none'
  | 'motto'
  | 'name'
  | 'initials'
  | 'scripture'
  | 'date'
  | 'other';

export type FlagAiEmblemPlacement =
  | 'none'
  | 'center'
  | 'canton'
  | 'hoist'
  | 'fly'
  | 'top'
  | 'bottom'
  | 'full_field';

export type FlagAiStructuredData = {
  dominantColors?: FlagAiColor[];
  secondaryColors?: FlagAiColor[];
  layoutType?: FlagAiLayoutType | null;
  patternType?: FlagAiPatternType | null;
  primarySymbols?: FlagAiSymbolType[];
  secondarySymbols?: FlagAiSymbolType[];
  symbolCount?: FlagAiSymbolCount | null;
  hasText?: boolean;
  textType?: FlagAiTextType | null;
  emblemPlacement?: FlagAiEmblemPlacement | null;
  regionTags?: string[];
  periodTags?: string[];
  styleTags?: string[];
  notes?: string[];
};

export const users = createTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  isAdmin: boolean('is_admin').notNull().default(false),
  // Trusted creators' flag requests and edits are approved automatically.
  isTrusted: boolean('is_trusted').notNull().default(false),
  name: varchar('name', { length: 255 }),
  userNumber: uuid('user_number').defaultRandom().notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  emailVerified: timestamp('email_verified', {
    mode: 'date',
    precision: 3,
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  image: varchar('image', { length: 255 }),
  hashedPassword: text('hashed_password'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  favoriteFlagId: uuid('favorite_flag_id').references(() => flags.id, {
    onDelete: 'set null',
  }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accounts = createTable(
  'account',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 255 })
      .$type<AdapterAccount['type']>()
      .notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', {
      length: 255,
    }).notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    id_token: text('id_token'),
    session_state: varchar('session_state', { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index('account_user_id_idx').on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  'session',
  {
    sessionToken: varchar('session_token', { length: 255 })
      .notNull()
      .primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (session) => ({
    userIdIdx: index('session_user_id_idx').on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  'verification_token',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const flags = createTable(
  'flag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    image: varchar('image', { length: 1000 }).notNull(),
    link: varchar('link', { length: 1000 }).notNull(),
    sources: text('sources').array().notNull().default([]),
    index: integer('index').notNull(),
    tags: text('tags').array().notNull().default([]),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    favorites: integer('favorites').notNull().default(0),
    // Lifetime page views, kept in step with flag_view_daily so lists can sort by it.
    views: integer('views').notNull().default(0),
    relatedFlags: jsonb('related_flags')
      .$type<string[]>()
      .notNull()
      .default([]),
    // Flags made in the flag maker: the flag it remixed (if any) and the editable design.
    remixOf: uuid('remix_of').references((): AnyPgColumn => flags.id, { onDelete: 'set null' }),
    design: jsonb('design').$type<StudioDesign>(),
  },
  (table) => ({
    indexUnique: uniqueIndex('index_unique').on(table.index),
  }),
);

/**
 * Page views per flag per UTC day. `views` counts every flag page view; `visitors`
 * counts distinct visitors that day. Rows from before tracking started were backfilled
 * from Vercel Web Analytics.
 */
export const flagViewDaily = createTable(
  'flag_view_daily',
  {
    flagId: uuid('flag_id')
      .notNull()
      .references(() => flags.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    views: integer('views').notNull().default(0),
    visitors: integer('visitors').notNull().default(0),
  },
  (table) => ({
    compoundKey: primaryKey({ columns: [table.flagId, table.day] }),
    dayIdx: index('flag_view_daily_day_idx').on(table.day),
  }),
);

/** A colour read from a flag's image, with the share of the flag it covers (0–1). */
export type FlagImageColor = { hex: string; name: string; share: number };

/**
 * Colours read from each flag's image. `families` holds broad colour names
 * (red, blue…) for colours covering a meaningful share, which is what search filters on.
 * `image` is the URL the colours were read from, so a changed image gets re-read.
 */
export const flagColors = createTable(
  'flag_color',
  {
    flagId: uuid('flag_id')
      .primaryKey()
      .references(() => flags.id, { onDelete: 'cascade' }),
    image: varchar('image', { length: 1000 }).notNull(),
    colors: jsonb('colors').$type<FlagImageColor[]>().notNull().default([]),
    families: text('families').array().notNull().default([]),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    familiesIdx: index('flag_color_families_idx').using('gin', table.families),
  }),
);

/**
 * Emblems cut out of flag images for the flag editor, one row per distinct emblem.
 * Each is cut from its best source flag (`flagId`); `appearsOn` lists every flag the same
 * shape was found on. `sourceKey` (catalogue index + position) lets re-imports update rows in place.
 * `box` is where the emblem sat on its source flag, as fractions of the flag's width and height;
 * `placements` has the same for every flag it appears on, so the flag maker can rebuild remixes.
 */
export const flagEmblems = createTable(
  'flag_emblem',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceKey: varchar('source_key', { length: 64 }).notNull(),
    flagId: uuid('flag_id')
      .notNull()
      .references(() => flags.id, { onDelete: 'cascade' }),
    image: varchar('image', { length: 1000 }).notNull(),
    svg: varchar('svg', { length: 1000 }),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    colors: text('colors').array().notNull().default([]),
    copies: integer('copies').notNull().default(1),
    share: real('share').notNull(),
    box: jsonb('box').$type<[number, number, number, number]>().notNull(),
    collection: varchar('collection', { length: 40 }).notNull(),
    appearsOn: uuid('appears_on').array().notNull().default([]),
    fingerprint: jsonb('fingerprint').$type<number[]>().notNull(),
    placements: jsonb('placements').$type<EmblemPlacement[]>().notNull().default([]),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    sourceKeyIdx: uniqueIndex('flag_emblem_source_key_idx').on(table.sourceKey),
    flagIdx: index('flag_emblem_flag_idx').on(table.flagId),
  }),
);

export const flagAiMetadata = createTable(
  'flag_ai_metadata',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    flagId: uuid('flag_id')
      .notNull()
      .references(() => flags.id, { onDelete: 'cascade' }),
    generationStatus: varchar('generation_status', { length: 50 })
      .notNull()
      .default('pending'),
    pipelineVersion: varchar('pipeline_version', { length: 100 })
      .notNull()
      .default('v1'),
    descriptionDraft: text('description_draft').notNull().default(''),
    tagsDraft: text('tags_draft').array().notNull().default([]),
    metaTags: text('meta_tags').array().notNull().default([]),
    detailedDescription: text('detailed_description').notNull().default(''),
    visualDescription: text('visual_description').notNull().default(''),
    historicalContext: text('historical_context').notNull().default(''),
    searchTokens: text('search_tokens').array().notNull().default([]),
    embeddingText: text('embedding_text').notNull().default(''),
    researchSources: jsonb('research_sources')
      .$type<FlagAiResearchSource[]>()
      .notNull()
      .default([]),
    structuredData: jsonb('structured_data').$type<FlagAiStructuredData | null>(),
    generatedAt: timestamp('generated_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    flagIdUnique: uniqueIndex('flag_ai_metadata_flag_id_unique').on(table.flagId),
    generationStatusIdx: index('flag_ai_metadata_generation_status_idx').on(
      table.generationStatus,
    ),
  }),
);

export const flagAiMetadataRelations = relations(flagAiMetadata, ({ one }) => ({
  flag: one(flags, { fields: [flagAiMetadata.flagId], references: [flags.id] }),
}));

export const flagRequests = createTable('flag_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  oldFlag: jsonb('old_flag').$type<Omit<Flag, 'id'>>(),
  approved: boolean('approved').notNull().default(false),
  flag: jsonb('flag').$type<Omit<Flag, 'id'>>().notNull(),
  flagId: varchar('flag_id', { length: 255 }),
  isEdit: boolean('is_edit').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  userMessage: text('user_message').notNull().default(''),
});

export const bannedUsers = createTable('banned_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  reason: varchar('reason', { length: 255 }).notNull().default(''),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const flagOfTheDay = createTable('flag_of_the_day', {
  id: uuid('id').primaryKey().defaultRandom(),
  flagId: uuid('flag_id')
    .notNull()
    .references(() => flags.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const leaderboard = createTable('leaderboard', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  contributions: integer('contributions').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const favorites = createTable('favorite', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  flagId: uuid('flag_id')
    .notNull()
    .references(() => flags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  flag: one(flags, { fields: [favorites.flagId], references: [flags.id] }),
}));

export const flagTags = createTable('flag_tag', {
  id: uuid('id').primaryKey().defaultRandom(),
  tag: varchar('tag', { length: 255 }).notNull(),
  count: integer('count').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const flagTagsRelations = relations(flagTags, ({ many }) => ({
  flags: many(flags),
}));

export const reports = createTable('report', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  flagId: uuid('flag_id')
    .notNull()
    .references(() => flags.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 255 }).notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at', { mode: 'date' }),
});
