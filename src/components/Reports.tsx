"use client";

import { useQuery } from "@tanstack/react-query";
import { getReports, resolveReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface ReportsProps {
	page: number;
}

function formatDistanceToNow(date: Date): string {
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
	if (diffInSeconds < 3600)
		return `${Math.floor(diffInSeconds / 60)} minutes ago`;
	if (diffInSeconds < 86400)
		return `${Math.floor(diffInSeconds / 3600)} hours ago`;
	if (diffInSeconds < 2592000)
		return `${Math.floor(diffInSeconds / 86400)} days ago`;
	return `${Math.floor(diffInSeconds / 2592000)} months ago`;
}

export function Reports({ page }: ReportsProps) {
	const {
		data: reportsData,
		isLoading,
		isRefetching,
		refetch,
	} = useQuery({
		queryKey: ["reports", page],
		queryFn: async () => {
			return getReports(10, (page - 1) * 10);
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-4">
				{Array.from({ length: 5 }).map((_, i) => (
					<Card key={i}>
						<CardContent className="p-4">
							<div className="space-y-2">
								<div className="h-4 bg-gray-200 rounded w-1/4"></div>
								<div className="h-4 bg-gray-200 rounded w-1/2"></div>
								<div className="h-4 bg-gray-200 rounded w-3/4"></div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	if (!reportsData || reportsData.length === 0) {
		return (
			<div className="text-center py-8">
				<AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
				<h3 className="mt-2 text-sm font-medium text-gray-900">No reports</h3>
				<p className="mt-1 text-sm text-gray-500">
					There are no flag reports to review.
				</p>
			</div>
		);
	}

	const handleResolveReport = async (reportId: string) => {
		resolveReport(reportId)
			.then(() => {
				refetch();
			})
			.catch((error) => {
				console.error(error);
				toast.error("Failed to resolve report");
			});
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Flag Reports</h2>
				<Badge variant="neutral" className="text-sm">
					{reportsData.length} Reports
				</Badge>
			</div>

			{reportsData.map((report) => (
				<Card key={report.id} className="overflow-hidden">
					<CardHeader className="pb-3">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-3">
								<div className="flex-shrink-0">
									<Image
										src={report.flagImage || "/logo.svg"}
										alt={report.flagName || "Flag"}
										width={48}
										height={32}
										className="rounded border object-cover"
										onError={(e) => {
											e.currentTarget.src = "/logo.svg";
										}}
									/>
								</div>
								<div>
									<CardTitle className="text-lg">
										{report.flagName || "Unknown Flag"}
									</CardTitle>
									<div className="flex items-center gap-2 mt-1">
										<Badge
											variant={report.resolved ? "default" : "neutral"}
											className="text-xs"
										>
											{report.resolved ? (
												<>
													<CheckCircle className="w-3 h-3 mr-1" />
													Resolved
												</>
											) : (
												<>
													<Clock className="w-3 h-3 mr-1" />
													Pending
												</>
											)}
										</Badge>
										<span className="text-xs text-muted-foreground">
											{formatDistanceToNow(new Date(report.createdAt))}
										</span>
									</div>
								</div>
							</div>
						</div>
					</CardHeader>

					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<h4 className="font-semibold text-sm mb-2">Report Details</h4>
								<div className="space-y-2">
									<div>
										<span className="text-xs text-muted-foreground">
											Reason:
										</span>
										<p className="text-sm font-medium">{report.reason}</p>
									</div>
									<div>
										<span className="text-xs text-muted-foreground">
											Description:
										</span>
										<p className="text-sm">
											{report.description || "No description provided"}
										</p>
									</div>
								</div>
							</div>

							<div>
								<h4 className="font-semibold text-sm mb-2">Reporter</h4>
								<div className="space-y-2">
									<div>
										<span className="text-xs text-muted-foreground">Name:</span>
										<p className="text-sm font-medium">
											{report.userName || "Anonymous"}
										</p>
									</div>
									<div>
										<span className="text-xs text-muted-foreground">
											Email:
										</span>
										<p className="text-sm">{report.userEmail || "No email"}</p>
									</div>
								</div>
							</div>
						</div>

						{report.flagDescription && (
							<div>
								<h4 className="font-semibold text-sm mb-2">Flag Description</h4>
								<p className="text-sm text-muted-foreground">
									{report.flagDescription}
								</p>
							</div>
						)}

						{report.resolved && report.resolvedAt && (
							<div className="bg-green-50 border border-green-200 rounded-lg p-3">
								<div className="flex items-center gap-2">
									<CheckCircle className="w-4 h-4 text-green-600" />
									<span className="text-sm font-medium text-green-800">
										Resolved {formatDistanceToNow(new Date(report.resolvedAt))}
									</span>
								</div>
							</div>
						)}

						{!report.resolved && (
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="default"
									onClick={() => handleResolveReport(report.id)}
									disabled={isRefetching}
								>
									Mark as Resolved
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
