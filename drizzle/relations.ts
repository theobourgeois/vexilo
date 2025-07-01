import { relations } from "drizzle-orm/relations";
import { vexiloUser, vexiloSession, vexiloFlagRequest, vexiloAccount } from "./schema";

export const vexiloSessionRelations = relations(vexiloSession, ({one}) => ({
	vexiloUser: one(vexiloUser, {
		fields: [vexiloSession.userId],
		references: [vexiloUser.id]
	}),
}));

export const vexiloUserRelations = relations(vexiloUser, ({many}) => ({
	vexiloSessions: many(vexiloSession),
	vexiloFlagRequests: many(vexiloFlagRequest),
	vexiloAccounts: many(vexiloAccount),
}));

export const vexiloFlagRequestRelations = relations(vexiloFlagRequest, ({one}) => ({
	vexiloUser: one(vexiloUser, {
		fields: [vexiloFlagRequest.userId],
		references: [vexiloUser.id]
	}),
}));

export const vexiloAccountRelations = relations(vexiloAccount, ({one}) => ({
	vexiloUser: one(vexiloUser, {
		fields: [vexiloAccount.userId],
		references: [vexiloUser.id]
	}),
}));