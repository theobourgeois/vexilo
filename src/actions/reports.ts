"use server";

import { db } from "@/db";
import { flags, reports, users } from "@/db/schema";
import { getUser } from "./auth";
import { getServerAuthSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function resolveReport(reportId: string) {
	const session = await getServerAuthSession();
	if (!session?.user.isAdmin) {
		throw new Error("Unauthorized");
	}

	await db
		.update(reports)
		.set({ resolved: true, resolvedAt: new Date() })
		.where(eq(reports.id, reportId));
}

export async function getReports(limit: number = 10, offset: number = 0) {
	const session = await getServerAuthSession();
	if (!session?.user.isAdmin) {
		throw new Error("Unauthorized");
	}

	const reportsData = await db
		.select({
			id: reports.id,
			flagId: reports.flagId,
			flagName: flags.name,
			flagImage: flags.image,
			flagDescription: flags.description,
			reason: reports.reason,
			description: reports.description,
			createdAt: reports.createdAt,
			resolved: reports.resolved,
			resolvedAt: reports.resolvedAt,
			userId: reports.userId,
			userName: users.name,
			userEmail: users.email,
		})
		.from(reports)
		.where(eq(reports.resolved, false))
		.leftJoin(flags, eq(reports.flagId, flags.id))
		.leftJoin(users, eq(reports.userId, users.id))
		.orderBy(reports.createdAt)
		.limit(limit)
		.offset(offset);

	return reportsData;
}

export async function createReport(
	flagId: string,
	reason: string,
	description: string,
) {
	if (description.length > 500) {
		return {
			success: false,
			message: "Description must be less than 500 characters",
		};
	}

	const user = await getUser();

	// Check if user has already reported this flag
	const existingReport = await db
		.select()
		.from(reports)
		.where(
			and(
				eq(reports.userId, user.id),
				eq(reports.flagId, flagId),
				eq(reports.resolved, false),
			),
		)
		.limit(1);

	if (existingReport.length > 0) {
		return {
			success: false,
			message:
				"You have already reported this flag. Please wait for it to be resolved.",
		};
	}

	const report = await db.insert(reports).values({
		userId: user.id,
		flagId,
		reason,
		description,
	});

	if (!report) {
		return {
			success: false,
			message: "Failed to create report",
		};
	}

	return {
		success: true,
		message: "Report created successfully",
	};
}
