"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, ArrowRight, Heart, Flag } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import FlagCard from "./FlagCard";
import { useQuery } from "@tanstack/react-query";
import {
	getFavoriteFlagsCount,
	getFavouriteFlags,
	getFlags,
	getFlagsCount,
	getTopFlagTags,
} from "@/actions/flags";
import { flags } from "@/db/schema";
import Tag from "./Tag";
import Link from "next/link";
import { cn } from "@/lib/utils";

type OrderBy = keyof typeof flags.$inferSelect;

const ITEMS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 300; // 300ms delay

// Flag Card Skeleton Component
function FlagCardSkeleton() {
	return (
		<Card className="px-8 relative">
			<div className="relative overflow-hidden">
				<div className="aspect-[3/2] relative">
					<Skeleton className="w-full h-full" />
				</div>
			</div>
			<CardContent className="pb-2">
				<Skeleton className="h-6 w-3/4 mx-auto" />
			</CardContent>
		</Card>
	);
}

// Simple Pagination Component
function SimplePagination({
	currentPage,
	totalPages,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;

	return (
		<div className="flex items-center justify-center gap-4">
			<Button
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
			>
				<ArrowLeft className="w-4 h-4" /> Previous
			</Button>
			<span className="text-sm">
				Page {currentPage} of {totalPages}
			</span>
			<Button
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
			>
				Next <ArrowRight className="w-4 h-4" />
			</Button>
		</div>
	);
}

export default function FlagSearch() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Local state for search query with debouncing
	const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
	const [debouncedQuery, setDebouncedQuery] = useState(
		searchParams.get("q") || "",
	);

	const isFavorites = searchParams.get("favorites") === "true";

	// Pagination controlled by URL
	const currentPage = parseInt(searchParams.get("page") || "1", 10);

	const orderBy = (searchParams.get("orderBy") as OrderBy) || "favorites";
	const orderDirection =
		(searchParams.get("orderDirection") as "asc" | "desc") || "desc";

	const { data: topFlagTags } = useQuery({
		queryKey: ["topFlagTags"],
		queryFn: async () => {
			return await getTopFlagTags(20);
		},
		staleTime: 10 * 60 * 1000, // 10 minutes
	});

	const tag = searchParams.get("tag") || "";

	const { data: flags, isLoading: flagsLoading } = useQuery({
		queryKey: [
			"flags",
			currentPage,
			debouncedQuery,
			isFavorites,
			orderBy,
			orderDirection,
			tag,
		],
		queryFn: async () => {
			const fetchFn = isFavorites ? getFavouriteFlags : getFlags;
			return await fetchFn(
				currentPage,
				ITEMS_PER_PAGE,
				debouncedQuery,
				orderBy,
				orderDirection,
				tag,
			).then((flags) => {
				return flags.map((flag) => ({
					favorites: flag.favorites,
					flagName: flag.name,
					flagImage: flag.image,
					link: flag.link,
					index: flag.index,
					tags: flag.tags,
					description: flag.description,
					id: flag.id,
					isFavorite: flag.isFavorite,
				}));
			});
		},
		staleTime: 2 * 60 * 1000, // 2 minutes
	});

	const { data: flagsCount } = useQuery({
		queryKey: ["flagsCount", debouncedQuery, isFavorites, tag],
		queryFn: async () => {
			const fetchFn = isFavorites ? getFavoriteFlagsCount : getFlagsCount;
			return await fetchFn(debouncedQuery, tag);
		},
		staleTime: 2 * 60 * 1000, // 2 minutes
	});

	const { data: totalFlags } = useQuery({
		queryKey: ["totalFlags", isFavorites, tag],
		queryFn: async () => {
			const fetchFn = isFavorites ? getFavoriteFlagsCount : getFlagsCount;
			return await fetchFn("", tag);
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, DEBOUNCE_DELAY);

		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Update URL when debounced query changes
	useEffect(() => {
		const params = new URLSearchParams(searchParams);

		if (debouncedQuery.trim()) {
			params.set("q", debouncedQuery);
		} else {
			params.delete("q");
		}

		const newUrl = params.toString()
			? `?${params.toString()}`
			: window.location.pathname;
		router.replace(newUrl, { scroll: false });
	}, [debouncedQuery, router, searchParams]);

	// Update page in URL
	const updatePage = useCallback(
		(newPage: number) => {
			const params = new URLSearchParams(searchParams);
			if (newPage > 1) {
				params.set("page", newPage.toString());
			} else {
				params.delete("page");
			}

			const newUrl = params.toString()
				? `?${params.toString()}`
				: window.location.pathname;
			router.replace(newUrl, { scroll: false });
		},
		[router, searchParams],
	);

	const totalPages = Math.ceil((flagsCount || 0) / ITEMS_PER_PAGE);

	const handleViewModeChange = useCallback(
		(newViewMode: boolean) => {
			const params = new URLSearchParams(searchParams);
			params.set("favorites", newViewMode ? "true" : "false");
			router.replace(`${window.location.pathname}?${params.toString()}`, {
				scroll: false,
			});
		},
		[router, searchParams],
	);

	const handleSortChange = useCallback(
		(newOrderBy: OrderBy, newOrderDirection: "asc" | "desc") => {
			const params = new URLSearchParams(searchParams);
			params.set("orderBy", newOrderBy);
			params.set("orderDirection", newOrderDirection);
			// Reset to first page when sorting changes
			params.set("page", "1");
			router.replace(`${window.location.pathname}?${params.toString()}`, {
				scroll: false,
			});
		},
		[router, searchParams],
	);

	return (
		<div className="space-y-6">
			{/* Search Header */}
			<Card>
				<CardHeader id="search-header">
					<div className="space-y-4">
						<div className="flex gap-2">
							<Button
								variant={isFavorites ? "neutral" : "default"}
								onClick={() => handleViewModeChange(false)}
							>
								<Flag className="w-4 h-4" />
								All Flags
							</Button>
							<Button
								variant={isFavorites ? "default" : "neutral"}
								onClick={() => handleViewModeChange(true)}
							>
								<Heart className="w-4 h-4" />
								Favorites
							</Button>
						</div>
						<div className="flex flex-col sm:flex-row gap-4 items-center">
							<div className="relative flex-1 md:max-w-md w-full">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
								<Input
									type="text"
									placeholder="Search flags..."
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value);
										const params = new URLSearchParams(searchParams);
										// set page to 1
										params.set("page", "1");
										router.replace(
											`${window.location.pathname}?${params.toString()}`,
											{ scroll: false },
										);
									}}
									className={cn("w-full pl-10", searchQuery && "pr-10")}
								/>
								{searchQuery && (
									<button
										onClick={() => {
											setSearchQuery("");
											const params = new URLSearchParams(searchParams);
											params.delete("page");
											router.replace(
												`${window.location.pathname}?${params.toString()}`,
												{ scroll: false },
											);
										}}
										className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
										type="button"
										aria-label="Clear search"
									>
										<X className="w-4 h-4" />
									</button>
								)}
							</div>

							{/* Sort Buttons */}
							<div className="flex gap-2">
								<Button
									variant={
										orderBy === "updatedAt" && orderDirection === "desc"
											? "default"
											: "neutral"
									}
									onClick={() => handleSortChange("updatedAt", "desc")}
								>
									Latest
								</Button>
								<Button
									variant={
										orderBy === "favorites" && orderDirection === "desc"
											? "default"
											: "neutral"
									}
									onClick={() => handleSortChange("favorites", "desc")}
								>
									Popular
								</Button>
							</div>

							<div className="text-sm text-gray-500">
								{flagsCount || 0} of {totalFlags || 0} flags
								{searchQuery !== debouncedQuery && (
									<span className="ml-2 text-blue-500">(searching...)</span>
								)}
							</div>
						</div>
						<div>
							{topFlagTags && (
								<div className="flex flex-wrap gap-2 items-center">
									<Tag
										onClick={() => {
											const params = new URLSearchParams(searchParams);
											params.delete("tag");
											router.replace(
												`${window.location.pathname}?${params.toString()}`,
												{ scroll: false },
											);
										}}
										isActive={!tag}
										text="All"
									/>
									{!topFlagTags.find((t) => t.tag === tag) && tag && (
										<Tag key={tag} text={tag} />
									)}
									{topFlagTags.map((tag) => (
										<Tag key={tag.tag} text={tag.tag} count={tag.count} />
									))}
									<Link className="text-main underline text-sm" href="/tags">
										View all tags
									</Link>
								</div>
							)}
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Top Pagination */}
			<SimplePagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={updatePage}
			/>

			{/* No Results Message */}
			{!flagsLoading && flags && flags.length === 0 && (
				<Card>
					<CardContent className="text-center py-12">
						<p className="text-gray-500 text-lg">
							{debouncedQuery
								? `No ${isFavorites ? "favorite " : ""}flags found matching "${debouncedQuery}"`
								: `No ${isFavorites ? "favorite " : ""}flags found`}
						</p>
						{debouncedQuery && (
							<Button
								variant="default"
								onClick={() => setSearchQuery("")}
								className="mt-4"
							>
								Clear Search
							</Button>
						)}
					</CardContent>
				</Card>
			)}

			{/* Results Grid */}
			{!flagsLoading && flags && flags.length > 0 && (
				<div
					id="flags"
					className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
				>
					{flags.map((flag) => (
						<FlagCard
							id={flag.id}
							key={flag.index}
							flagName={flag.flagName}
							flagImage={flag.flagImage}
							link={flag.link}
							index={flag.index}
							tags={flag.tags}
							description={flag.description}
							favorites={flag.favorites}
							isFavorite={flag.isFavorite}
						/>
					))}
				</div>
			)}

			{/* Loading Skeleton */}
			{flagsLoading && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
						<FlagCardSkeleton key={`skeleton-${index}`} />
					))}
				</div>
			)}

			{/* Bottom Pagination */}
			<SimplePagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={updatePage}
			/>
		</div>
	);
}
