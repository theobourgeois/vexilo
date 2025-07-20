"use client";

import {
	createAdminFlags,
	generateFlagOfTheDay,
	getFlags,
	updateFlag,
	deleteFlag,
} from "@/actions/flags";
import { getPendingFlagRequests } from "@/actions/requests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FlagRequestCard } from "@/components/FlagRequestCard";
import { Reports } from "@/components/Reports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Save, X, Trash2 } from "lucide-react";
import Image from "next/image";

function Requests({ page }: { page: number }) {
	const { data: flagRequestsData } = useQuery({
		queryKey: ["flagRequests", page],
		queryFn: async () => {
			return getPendingFlagRequests(page, 10);
		},
	});

	const flagRequests = flagRequestsData?.flagRequests;
	const total = flagRequestsData?.total;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Pending Flag Requests</h2>
				<Badge variant="neutral" className="text-sm">
					{total} Pending Requests
				</Badge>
			</div>
			{flagRequests?.map((flagRequest) => (
				<div key={flagRequest.id} className="space-y-4">
					{flagRequest.userMessage && (
						<div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
							<div className="flex items-start gap-2">
								<div className="text-blue-600 font-semibold">User Message:</div>
								<div className="text-blue-800">{flagRequest.userMessage}</div>
							</div>
						</div>
					)}
					<FlagRequestCard
						isEdit={flagRequest.flagId !== null}
						flagRequest={flagRequest}
						page={page}
					/>
				</div>
			))}
		</div>
	);
}

function Pagination({ page }: { page: number }) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const handlePageChange = (newPage: number) => {
		const params = new URLSearchParams(searchParams);
		params.set("page", newPage.toString());
		router.push(`/admin?${params.toString()}`);
	};

	return (
		<div className="flex items-center gap-4 mt-4">
			<Button
				variant="neutral"
				onClick={() => handlePageChange(page - 1)}
				disabled={page <= 1}
			>
				Previous
			</Button>
			<span className="text-sm text-muted-foreground">Page {page}</span>
			<Button variant="neutral" onClick={() => handlePageChange(page + 1)}>
				Next
			</Button>
		</div>
	);
}

function EditFlags({ page }: { page: number }) {
	const [searchQuery, setSearchQuery] = useState("");
	const [editingFlag, setEditingFlag] = useState<string | null>(null);
	const [editData, setEditData] = useState<{
		name: string;
		image: string;
		link: string;
		description: string;
		tags: string;
	}>({
		name: "",
		image: "",
		link: "",
		description: "",
		tags: "",
	});

	const { data: flagsData, isLoading } = useQuery({
		queryKey: ["adminFlags", page, searchQuery],
		queryFn: async () => {
			return getFlags(page, 10, searchQuery || undefined);
		},
	});

	const queryClient = useQueryClient();

	const handleEdit = (flag: {
		id: string;
		name: string;
		image: string;
		link: string;
		description: string;
		tags: string[];
		favorites: number;
	}) => {
		setEditingFlag(flag.id);
		setEditData({
			name: flag.name,
			image: flag.image,
			link: flag.link,
			description: flag.description,
			tags: flag.tags.join(", "),
		});
	};

	const handleSave = async (flagId: string) => {
		try {
			await updateFlag(flagId, {
				name: editData.name,
				image: editData.image,
				link: editData.link,
				description: editData.description,
				tags: editData.tags
					.split(",")
					.map((tag) => tag.trim())
					.filter((tag) => tag),
			});

			setEditingFlag(null);
			queryClient.invalidateQueries({ queryKey: ["adminFlags"] });
			toast.success("Flag updated successfully");
		} catch (error) {
			toast.error("Error updating flag");
			console.error(error);
		}
	};

	const handleCancel = () => {
		setEditingFlag(null);
	};

	const handleDelete = async (flagId: string) => {
		if (!confirm("Are you sure you want to delete this flag?")) {
			return;
		}

		try {
			await deleteFlag(flagId);
			queryClient.invalidateQueries({ queryKey: ["adminFlags"] });
			toast.success("Flag deleted successfully");
		} catch (error) {
			toast.error("Error deleting flag");
			console.error(error);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold">Edit Flags</h2>
				<div className="relative w-64">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
					<Input
						type="text"
						placeholder="Search flags..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>
			</div>

			{isLoading ? (
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
			) : (
				<div className="space-y-4">
					{flagsData?.map((flag) => (
						<Card key={flag.id}>
							<CardContent className="p-4">
								{editingFlag === flag.id ? (
									<div className="space-y-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label htmlFor="name">Name</Label>
												<Input
													id="name"
													value={editData.name}
													onChange={(e) =>
														setEditData((prev) => ({
															...prev,
															name: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="image">Image URL</Label>
												<Input
													id="image"
													value={editData.image}
													onChange={(e) =>
														setEditData((prev) => ({
															...prev,
															image: e.target.value,
														}))
													}
												/>
											</div>
										</div>
										<div className="space-y-2">
											<Label htmlFor="link">Link</Label>
											<Input
												id="link"
												value={editData.link}
												onChange={(e) =>
													setEditData((prev) => ({
														...prev,
														link: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="description">Description</Label>
											<Textarea
												id="description"
												value={editData.description}
												onChange={(e) =>
													setEditData((prev) => ({
														...prev,
														description: e.target.value,
													}))
												}
												rows={3}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="tags">Tags (comma-separated)</Label>
											<Input
												id="tags"
												value={editData.tags}
												onChange={(e) =>
													setEditData((prev) => ({
														...prev,
														tags: e.target.value,
													}))
												}
											/>
										</div>
										<div className="flex gap-2">
											<Button onClick={() => handleSave(flag.id)} size="sm">
												<Save className="w-4 h-4 mr-2" />
												Save
											</Button>
											<Button
												variant="neutral"
												onClick={handleCancel}
												size="sm"
											>
												<X className="w-4 h-4 mr-2" />
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<div className="space-y-4">
										<div className="flex items-start justify-between gap-4">
											<div className="flex-1">
												<div className="flex gap-4">
													<div className="flex-shrink-0">
														<Image
															src={flag.image}
															alt={flag.name}
															className="w-24 h-16 object-cover rounded border"
															onError={(e) => {
																e.currentTarget.src = "/logo.svg";
															}}
															width={96}
															height={64}
														/>
													</div>
													<div className="flex-1">
														<h3 className="font-semibold text-lg">
															{flag.name}
														</h3>
														<p className="text-sm text-gray-600 mt-1">
															{flag.description}
														</p>
														<div className="flex flex-wrap gap-1 mt-2">
															{flag.tags.map((tag: string, index: number) => (
																<Badge
																	key={index}
																	variant="neutral"
																	className="text-xs"
																>
																	{tag}
																</Badge>
															))}
														</div>
														<div className="text-xs text-gray-500 mt-2">
															<div>Image: {flag.image}</div>
															<div>Link: {flag.link}</div>
															<div>Favorites: {flag.favorites}</div>
														</div>
													</div>
												</div>
											</div>
											<div className="flex gap-2">
												<Button onClick={() => handleEdit(flag)} size="sm">
													Edit
												</Button>
												<Button
													onClick={() => handleDelete(flag.id)}
													size="sm"
													className="bg-red-500 hover:bg-red-600 text-white"
												>
													<Trash2 className="w-4 h-4" />
												</Button>
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

function MiscSection() {
	const queryClient = useQueryClient();

	const handleImportFlags = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				const text = e.target?.result as string;
				try {
					const flags = JSON.parse(text);

					console.log(flags.slice(0, 10));
					if (flags.length > 0) {
						toast.loading("Importing flags...");
						createAdminFlags(flags)
							.then(() => {
								toast.dismiss();
								toast.success("Flags imported successfully");
							})
							.catch((error) => {
								toast.dismiss();
								toast.error(
									`Error importing flags: ${error.message || "Unknown error"}`,
								);
								console.error(error);
							});
					}
				} catch (parseError) {
					toast.error("Error parsing JSON file");
					console.error(parseError);
				}
			};
			reader.onerror = () => {
				toast.error("Error reading file");
			};
			reader.readAsText(file);
		}
	};

	const handleGenerateFlagOfTheDay = async () => {
		try {
			toast.loading("Generating flag of the day...");
			await generateFlagOfTheDay();
			toast.dismiss();
			toast.success("Flag of the day generated successfully");
			// Invalidate the flag of the day query to refresh the data
			queryClient.invalidateQueries({ queryKey: ["flagOfTheDay"] });
		} catch (error) {
			toast.dismiss();
			toast.error("Error generating flag of the day");
			console.error(error);
		}
	};

	return (
		<div className="space-y-6">
			<h2 className="text-2xl font-bold">Miscellaneous Actions</h2>

			<div className="space-y-4">
				<div className="space-y-2">
					<h3 className="text-lg font-semibold">Import Flags</h3>
					<p className="text-sm text-muted-foreground">
						Upload a JSON file containing flag data to import into the database.
					</p>
					<Input
						className="w-min"
						type="file"
						accept=".json"
						onChange={handleImportFlags}
					/>
				</div>

				<div className="space-y-2">
					<h3 className="text-lg font-semibold">Generate Flag of the Day</h3>
					<p className="text-sm text-muted-foreground">
						Manually generate a new flag of the day. This will replace the
						current flag of the day.
					</p>
					<Button onClick={handleGenerateFlagOfTheDay}>
						Generate Flag of the Day
					</Button>
				</div>
			</div>
		</div>
	);
}

function AdminContent() {
	const auth = useSession();
	const isAdmin = auth.data?.user?.isAdmin;
	const searchParams = useSearchParams();
	const page = Number(searchParams.get("page")) || 1;

	if (!isAdmin) {
		return <div>Unauthorized</div>;
	}

	return (
		<div className="min-h-screen bg-main/10 w-screen">
			<div className="max-w-7xl mx-auto px-4 gap-2 flex flex-col items-start justify-start py-4">
				<h1 className="text-4xl font-bold">Admin Page</h1>
				<div className="w-full">
					<Tabs defaultValue="requests" className="w-full">
						<TabsList>
							<TabsTrigger value="requests">Flag Requests</TabsTrigger>
							<TabsTrigger value="reports">Reports</TabsTrigger>
							<TabsTrigger value="edit">Edit Flags</TabsTrigger>
							<TabsTrigger value="misc">Misc</TabsTrigger>
						</TabsList>

						<TabsContent value="requests" className="space-y-4">
							<Requests page={page} />
							<Pagination page={page} />
						</TabsContent>

						<TabsContent value="reports" className="space-y-4">
							<Reports page={page} />
							<Pagination page={page} />
						</TabsContent>

						<TabsContent value="edit" className="space-y-4">
							<EditFlags page={page} />
							<Pagination page={page} />
						</TabsContent>

						<TabsContent value="misc">
							<MiscSection />
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

export default function AdminPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<AdminContent />
		</Suspense>
	);
}
