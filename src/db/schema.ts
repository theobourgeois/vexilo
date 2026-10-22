import { Flag } from '@/lib/types';
import type { EmblemPlacement, StoredStudioDesign } from '@/lib/studio-design';
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
}, (table) => [uniqueIndex('user_email_unique').on(sql`lower(${table.email})`)]);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

/** Pending email signups. Passwords are hashed; codes are HMACs, never plaintext. */
export const emailChallenges = createTable('email_challenge', {
  email: varchar('email', { length: 255 }).primaryKey(),
  id: uuid('id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  hashedPassword: text('hashed_password').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  codeHash: varchar('code_hash', { length: 64 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  sentAt: timestamp('sent_at', { mode: 'date' }).notNull(),
}, (table) => [index('email_challenge_expires_idx').on(table.expiresAt)]);

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
    design: jsonb('design').$type<StoredStudioDesign>(),
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

/** One dated step in a flag's design history. See src/lib/ai/flag-timeline-pipeline.ts. */
export type FlagTimelineEvent = {
  year: number;
  endYear: number | null;
  kind: 'designed' | 'adopted' | 'modified' | 'readopted' | 'standardized' | 'replaced' | 'abolished' | 'other' | 'version';
  title: string;
  detail: string;
  sources: string[];
  /** The catalogue page for the version this event introduced, when there is one. */
  versionFlagId: string | null;
  /** Where the event came from: web research, an older version in the catalogue, or both. */
  origin: 'research' | 'catalogue' | 'both';
};

/**
 * A flag's design history, one row per flag. `status` is 'insufficient' when research found too little,
 * so the flag isn't researched again. `research` keeps what was dropped and why, the pages searched, and cost.
 */
export const flagTimelines = createTable(
  'flag_timeline',
  {
    flagId: uuid('flag_id')
      .primaryKey()
      .references(() => flags.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(),
    events: jsonb('events').$type<FlagTimelineEvent[]>().notNull().default([]),
    model: varchar('model', { length: 100 }).notNull(),
    pipelineVersion: varchar('pipeline_version', { length: 50 }).notNull(),
    research: jsonb('research').$type<Record<string, unknown>>().notNull().default({}),
    generatedAt: timestamp('generated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    // Finds the timeline a historical version belongs to: events @> '[{"versionFlagId": "…"}]'.
    eventsIdx: index('flag_timeline_events_idx').using('gin', table.events.op('jsonb_path_ops')),
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
    name: varchar('name', { length: 160 }).notNull().default(''),
    tags: text('tags').array().notNull().default([]),
    category: varchar('category', { length: 32 }).notNull().default('unsorted'),
    rank: integer('rank').notNull().default(0),
    // Retired drawings remain available to existing designs and remix placements.
    isActive: boolean('is_active').notNull().default(true),
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

/**
 * Each SVG flag split into its field and objects, as a ready-made flag maker design for remixes.
 * `image` and `sourceHash` are what the parts were cut from, so a changed image is cut again;
 * `version` is the extractor's, so improving it can redo them all. `status` is 'ok' with a
 * design, or 'failed' with an error (the live remix handles those). `mismatch` is the share of the
 * flag's pixels that differ when it's rebuilt from the design; designs that differ much fail.
 */
export const flagParts = createTable('flag_parts', {
  flagId: uuid('flag_id')
    .primaryKey()
    .references(() => flags.id, { onDelete: 'cascade' }),
  image: varchar('image', { length: 1000 }).notNull(),
  sourceHash: varchar('source_hash', { length: 64 }).notNull(),
  version: integer('version').notNull(),
  status: varchar('status', { length: 20 }).$type<'ok' | 'failed'>().notNull(),
  error: text('error'),
  design: jsonb('design').$type<StoredStudioDesign>(),
  mismatch: real('mismatch'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

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
  // When the request was published; the homepage's weekly top contributors count from it.
  approvedAt: timestamp('approved_at', { mode: 'date' }),
}, (table) => [index('flag_request_approved_at_idx').on(table.approvedAt)]);

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

/**
 * One finished daily game per player (a browser, signed in or not), so a result can be compared
 * with everyone else's that day. `score` is guesses used for Unfurl (7 when unsolved) and squares
 * filled for Vexigrid; `picks` holds the guesses or the board, so other stats can be worked out later.
 */
export const gameResults = createTable(
  'game_result',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    game: varchar('game', { length: 16 }).$type<'unfurl' | 'grid'>().notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    player: varchar('player', { length: 64 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    solved: boolean('solved').notNull(),
    guesses: integer('guesses').notNull(),
    score: integer('score').notNull(),
    picks: jsonb('picks').$type<(string | null)[]>().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('game_result_player_idx').on(table.game, table.date, table.player),
    index('game_result_user_idx').on(table.userId),
  ],
);

/**
 * A design contest. Its phase follows the dates (see src/lib/contest.ts): entries open at
 * `startsAt`, voting runs from `votingStartsAt` to `endsAt`, and the winner only shows once an admin
 * sets `winnerEntryId` and `announcedAt`. Drafts (`published` false) are visible to admins only.
 */
export const contests = createTable(
  'contest',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 80 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    theme: varchar('theme', { length: 160 }).notNull(),
    brief: text('brief').notNull().default(''),
    rules: text('rules').array().notNull().default([]),
    prize: varchar('prize', { length: 200 }).notNull().default(''),
    startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
    votingStartsAt: timestamp('voting_starts_at', { mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
    votesPerVoter: integer('votes_per_voter').notNull().default(3),
    published: boolean('published').notNull().default(false),
    winnerEntryId: uuid('winner_entry_id'),
    announcedAt: timestamp('announced_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('contest_slug_idx').on(table.slug), index('contest_starts_idx').on(table.startsAt)],
);

/**
 * One design per person per contest, made in the flag maker. Entries stay anonymous until the
 * winner is announced. `ipHash` (a salted hash, never the address) helps spot people voting for
 * themselves from other accounts. `flagId` is set once the entry is published to Browse.
 */
export const contestEntries = createTable(
  'contest_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contestId: uuid('contest_id')
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 120 }).notNull(),
    statement: varchar('statement', { length: 400 }).notNull().default(''),
    image: varchar('image', { length: 1000 }).notNull(),
    design: jsonb('design').$type<StoredStudioDesign>().notNull(),
    status: varchar('status', { length: 16 }).$type<'active' | 'disqualified'>().notNull().default('active'),
    statusReason: varchar('status_reason', { length: 200 }).notNull().default(''),
    ipHash: varchar('ip_hash', { length: 64 }),
    flagId: uuid('flag_id').references(() => flags.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('contest_entry_user_idx').on(table.contestId, table.userId),
    index('contest_entry_user_id_idx').on(table.userId),
  ],
);

/** One vote per voter per entry. Admins can void a vote; voided votes stop counting but are kept. */
export const contestVotes = createTable(
  'contest_vote',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contestId: uuid('contest_id')
      .notNull()
      .references(() => contests.id, { onDelete: 'cascade' }),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => contestEntries.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipHash: varchar('ip_hash', { length: 64 }),
    voidedAt: timestamp('voided_at', { mode: 'date' }),
    voidReason: varchar('void_reason', { length: 200 }).notNull().default(''),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('contest_vote_voter_idx').on(table.entryId, table.userId),
    index('contest_vote_contest_user_idx').on(table.contestId, table.userId),
  ],
);

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
