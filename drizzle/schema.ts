import { pgTable, uuid, boolean, varchar, timestamp, text, index, foreignKey, uniqueIndex, integer, jsonb, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const vexiloUser = pgTable("vexilo_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	isAdmin: boolean("is_admin").default(false).notNull(),
	name: varchar({ length: 255 }),
	email: varchar({ length: 255 }).notNull(),
	emailVerified: timestamp("email_verified", { precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP(3)`),
	image: varchar({ length: 255 }),
	hashedPassword: text("hashed_password"),
});

export const vexiloSession = pgTable("vexilo_session", {
	sessionToken: varchar("session_token", { length: 255 }).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("session_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [vexiloUser.id],
		name: "vexilo_session_user_id_vexilo_user_id_fk"
	}).onDelete("cascade"),
]);

export const vexiloFlag = pgTable("vexilo_flag", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	image: varchar({ length: 1000 }).notNull(),
	link: varchar({ length: 1000 }).notNull(),
	index: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	tags: text().array().default([""]).notNull(),
	description: text().default('').notNull(),
}, (table) => [
	uniqueIndex("index_unique").using("btree", table.index.asc().nullsLast().op("int4_ops")),
]);

export const vexiloFlagRequest = pgTable("vexilo_flag_request", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	flag: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	flagId: varchar("flag_id", { length: 255 }),
}, (table) => [
	foreignKey({
		columns: [table.userId],
		foreignColumns: [vexiloUser.id],
		name: "vexilo_flag_request_user_id_vexilo_user_id_fk"
	}),
]);

export const vexiloVerificationToken = pgTable("vexilo_verification_token", {
	identifier: varchar({ length: 255 }).notNull(),
	token: varchar({ length: 255 }).notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.identifier, table.token], name: "vexilo_verification_token_identifier_token_pk" }),
]);

export const vexiloAccount = pgTable("vexilo_account", {
	userId: uuid("user_id").notNull(),
	type: varchar({ length: 255 }).notNull(),
	provider: varchar({ length: 255 }).notNull(),
	providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: varchar("token_type", { length: 255 }),
	scope: varchar({ length: 255 }),
	idToken: text("id_token"),
	sessionState: varchar("session_state", { length: 255 }),
}, (table) => [
	index("account_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [vexiloUser.id],
		name: "vexilo_account_user_id_vexilo_user_id_fk"
	}),
	primaryKey({ columns: [table.provider, table.providerAccountId], name: "vexilo_account_provider_provider_account_id_pk" }),
]);
