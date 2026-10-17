"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getAllFlagTags } from "@/actions/flags";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Search } from "@/components/icons";

const ITEMS_PER_PAGE = 50;

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
		<div className="flex items-center justify-center gap-3">
			<Button
				variant="neutral"
				size="icon"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage <= 1}
				aria-label="Previous page"
			>
				<ArrowLeft />
			</Button>
			<span className="min-w-28 text-center tabular-nums text-xs text-muted-foreground">
				{currentPage} / {totalPages}
			</span>
			<Button
				variant="neutral"
				size="icon"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage >= totalPages}
				aria-label="Next page"
			>
				<ArrowRight />
			</Button>
		</div>
	);
}

export default function TagsPage() {
	const [search, setSearch] = useState("");
	const [currentPage, setCurrentPage] = useState(1);

	const { data: tagsData, isLoading } = useQuery({
		queryKey: ["allFlagTags", search, currentPage],
		queryFn: () => getAllFlagTags(search, currentPage, ITEMS_PER_PAGE),
	});

	// Reset to first page when search changes
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(e.target.value);
		setCurrentPage(1);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		window.scrollTo({ top: 0 });
	};

	const tags = tagsData?.tags ?? [];
	const totalCount = tagsData?.totalCount ?? 0;
	const rangeStart = (currentPage - 1) * ITEMS_PER_PAGE + 1;
	const rangeEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

	return (
		<div className="mx-auto max-w-[1040px] px-4 pb-16 md:px-8">
			<div className="flex flex-col gap-4 pb-[18px] pt-7 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="flex items-baseline gap-2.5 text-[22px] font-semibold tracking-[-0.03em]">
						Tags
						{tagsData && (
							<span className="tabular-nums text-sm font-normal tracking-normal text-muted-foreground">
								{totalCount.toLocaleString()}
							</span>
						)}
					</h1>
					<p className="mt-0.5 text-[13px] text-muted-foreground">
						Every tag used on Vexilo. Select one to browse its flags.
					</p>
				</div>
				<div className="relative w-full sm:w-[300px]">
					<Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search tags"
						value={search}
						onChange={handleSearchChange}
						className="pl-10"
						aria-label="Search tags"
					/>
				</div>
			</div>

			<div className="vx-tile p-1.5">
				<div className="vx-label grid h-[38px] grid-cols-[1fr_auto] items-center px-3.5">
					<span>Tag</span>
					<span>
						{tagsData && totalCount > 0
							? `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalCount.toLocaleString()}`
							: "Flags"}
					</span>
				</div>
				{isLoading ? (
					<div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 18 }).map((_, i) => (
							<div
								key={i}
								className="flex h-11 items-center justify-between px-3.5 shadow-[0_-1px_0_var(--line)]"
							>
								<div className="h-3.5 w-28 animate-pulse rounded bg-foreground/[0.06]" />
								<div className="h-3 w-8 animate-pulse rounded bg-foreground/[0.06]" />
							</div>
						))}
					</div>
				) : tags.length > 0 ? (
					<ul className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
						{tags.map((tag) => (
							<li key={tag.tag} className="shadow-[0_-1px_0_var(--line)]">
								<Link
									href={`/?tag=${encodeURIComponent(tag.tag)}`}
									className="group flex h-11 items-center gap-3 rounded-xl px-3.5 transition-colors hover:bg-foreground/[0.03]"
								>
									<span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-subtle transition-colors group-hover:text-foreground">
										{tag.tag}
									</span>
									<span className="shrink-0 tabular-nums text-[11.5px] text-muted-foreground">
										{tag.count.toLocaleString()}
									</span>
								</Link>
							</li>
						))}
					</ul>
				) : (
					<div className="px-6 py-14 text-center text-[13px] text-muted-foreground shadow-[0_-1px_0_var(--line)]">
						{search ? `No tags match “${search}”.` : "No tags yet."}
					</div>
				)}
			</div>

			{tagsData && (
				<div className="mt-6">
					<SimplePagination
						currentPage={currentPage}
						totalPages={tagsData.totalPages}
						onPageChange={handlePageChange}
					/>
				</div>
			)}
		</div>
	);
}
