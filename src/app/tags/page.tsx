"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllFlagTags } from "@/actions/flags";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Tag from "@/components/Tag";
import { Loader2 } from "lucide-react";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 50;

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
	};

	// Generate pagination items
	const generatePaginationItems = () => {
		if (!tagsData) return [];

		const { currentPage, totalPages } = tagsData;
		const items = [];

		// Always show first page
		items.push(1);

		// Show ellipsis if there's a gap
		if (currentPage > 4) {
			items.push("ellipsis-start");
		}

		// Show pages around current page
		for (
			let i = Math.max(2, currentPage - 1);
			i <= Math.min(totalPages - 1, currentPage + 1);
			i++
		) {
			if (i > 1 && i < totalPages) {
				items.push(i);
			}
		}

		// Show ellipsis if there's a gap
		if (currentPage < totalPages - 3) {
			items.push("ellipsis-end");
		}

		// Always show last page if there's more than one page
		if (totalPages > 1) {
			items.push(totalPages);
		}

		return items;
	};

	return (
		<div className="max-w-4xl mx-auto px-4 py-12">
			<div className="space-y-6">
				<div className="text-center">
					<h1 className="text-3xl font-bold tracking-tight mb-2">All Tags</h1>
					<p className="text-muted-foreground mt-2 mb-4">
						Browse and search all tags used on Vexilo
					</p>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Search Tags</CardTitle>
						<Input
							placeholder="Search tags..."
							value={search}
							onChange={handleSearchChange}
							className="mt-2"
						/>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : (
							<div className="space-y-4">
								<div className="flex flex-wrap gap-2 items-center">
									{tagsData?.tags && tagsData.tags.length > 0 ? (
										tagsData.tags.map((tag) => (
											<Tag key={tag.tag} text={tag.tag} count={tag.count} />
										))
									) : (
										<div className="text-muted-foreground py-8 w-full text-center">
											No tags found.
										</div>
									)}
								</div>

								{tagsData && tagsData.totalPages > 1 && (
									<div className="flex justify-between items-center pt-4 border-t">
										<div className="text-sm text-muted-foreground">
											Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
											{Math.min(
												currentPage * ITEMS_PER_PAGE,
												tagsData.totalCount,
											)}{" "}
											of {tagsData.totalCount} tags
										</div>
										<Pagination>
											<PaginationContent>
												<PaginationItem>
													<PaginationPrevious
														onClick={() => handlePageChange(currentPage - 1)}
														className={
															currentPage <= 1
																? "pointer-events-none opacity-50"
																: "cursor-pointer"
														}
													/>
												</PaginationItem>

												{generatePaginationItems().map((item) => (
													<PaginationItem key={`page-${item}`}>
														{item === "ellipsis-start" ||
														item === "ellipsis-end" ? (
															<PaginationEllipsis />
														) : (
															<PaginationLink
																isActive={currentPage === item}
																onClick={() => handlePageChange(item as number)}
																className="cursor-pointer"
															>
																{item}
															</PaginationLink>
														)}
													</PaginationItem>
												))}

												<PaginationItem>
													<PaginationNext
														onClick={() => handlePageChange(currentPage + 1)}
														className={
															currentPage >= tagsData.totalPages
																? "pointer-events-none opacity-50"
																: "cursor-pointer"
														}
													/>
												</PaginationItem>
											</PaginationContent>
										</Pagination>
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
