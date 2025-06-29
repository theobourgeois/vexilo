"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { Search, Heart, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import FlagCard from "./FlagCard";
import { useFavoritesStore } from "../store/favorites";

type Flag = {
    flagName: string;
    flagImage: string;
    link: string;
    index: number;
};

type FlagSearchProps = {
    flags: Flag[];
};

const ITEMS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 300; // 300ms delay

export default function FlagSearch({ flags }: FlagSearchProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { favorites } = useFavoritesStore();

    // Local state for search query with debouncing
    const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
    const [debouncedQuery, setDebouncedQuery] = useState(
        searchParams.get("q") || ""
    );

    // Pagination controlled by URL
    const currentPage = parseInt(searchParams.get("page") || "1", 10);
    const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");

    // Window size state for responsive pagination
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1024
    );

    // Configure Fuse.js for fuzzy search
    const fuse = useMemo(() => {
        return new Fuse(flags, {
            keys: ["flagName"],
            threshold: 0.3,
            includeScore: true,
        });
    }, [flags]);

    // Get flags based on active tab
    const getFlagsForTab = useCallback(() => {
        if (activeTab === "favorites") {
            return flags.filter((flag) => favorites.includes(flag.flagName));
        }
        return flags;
    }, [activeTab, flags, favorites]);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Handle window resize for responsive pagination
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

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
        [router, searchParams]
    );

    // Filter flags based on debounced search query and active tab
    const filteredFlags = useMemo(() => {
        const tabFlags = getFlagsForTab();
        if (!debouncedQuery.trim()) {
            return tabFlags;
        }
        const results = fuse.search(debouncedQuery);
        return results
            .map((result) => result.item)
            .filter((flag) =>
                tabFlags.some((tabFlag) => tabFlag.flagName === flag.flagName)
            );
    }, [debouncedQuery, fuse, getFlagsForTab]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredFlags.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const displayedFlags = filteredFlags.slice(startIndex, endIndex);

    // Generate page numbers for pagination
    const getPageNumbers = useMemo(() => {
        const pages = [];

        // Responsive max visible pages based on screen size
        const getMaxVisiblePages = () => {
            if (windowWidth < 640) return 2; // sm breakpoint
            if (windowWidth < 1024) return 4; // lg breakpoint
            return 5; // default
        };

        const maxVisiblePages = getMaxVisiblePages();

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= Math.ceil(maxVisiblePages / 2)) {
                // Near the beginning
                for (let i = 1; i <= maxVisiblePages - 1; i++) {
                    pages.push(i);
                }
                pages.push("ellipsis");
                pages.push(totalPages);
            } else if (
                currentPage >=
                totalPages - Math.floor(maxVisiblePages / 2)
            ) {
                // Near the end
                pages.push(1);
                pages.push("ellipsis");
                for (
                    let i = totalPages - (maxVisiblePages - 2);
                    i <= totalPages;
                    i++
                ) {
                    pages.push(i);
                }
            } else {
                // In the middle
                if (windowWidth >= 640) {
                    pages.push(1);
                    pages.push("ellipsis");
                } else {
                    pages.push(currentPage);
                }
                const start =
                    currentPage - Math.floor((maxVisiblePages - 4) / 2);
                const end = start + (maxVisiblePages - 4);
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }
                if (windowWidth >= 640) {
                    pages.push("ellipsis");
                    pages.push(totalPages);
                } else {
                }
            }
        }

        return pages;
    }, [currentPage, totalPages, windowWidth]);

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <Card>
                <CardHeader>
                    <div className="space-y-4">
                        {/* Tabs */}
                        <div className="flex gap-2">
                            <Button
                                variant={
                                    activeTab === "all" ? "default" : "neutral"
                                }
                                size="sm"
                                onClick={() => setActiveTab("all")}
                            >
                                All Flags
                            </Button>
                            <Button
                                variant={
                                    activeTab === "favorites"
                                        ? "default"
                                        : "neutral"
                                }
                                size="sm"
                                onClick={() => setActiveTab("favorites")}
                                className="flex items-center gap-2"
                            >
                                <Heart className="w-4 h-4" />
                                Favorites ({favorites.length})
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder="Search flags..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        const params = new URLSearchParams(
                                            searchParams
                                        );
                                        // set page to 1
                                        params.set("page", "1");
                                        router.replace(
                                            `${
                                                window.location.pathname
                                            }?${params.toString()}`,
                                            { scroll: false }
                                        );
                                    }}
                                    className={`pl-10 ${
                                        searchQuery ? "pr-10" : ""
                                    }`}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery("");
                                            const params = new URLSearchParams(
                                                searchParams
                                            );
                                            params.delete("page");
                                            router.replace(
                                                `${
                                                    window.location.pathname
                                                }?${params.toString()}`,
                                                { scroll: false }
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
                            <div className="text-sm text-gray-500">
                                {filteredFlags.length} of{" "}
                                {getFlagsForTab().length} flags
                                {searchQuery !== debouncedQuery && (
                                    <span className="ml-2 text-blue-500">
                                        (searching...)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Top Pagination */}
            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage > 1) {
                                        updatePage(currentPage - 1);
                                    }
                                }}
                                className={
                                    currentPage === 1
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            />
                        </PaginationItem>

                        {getPageNumbers.map((page, index) => (
                            <PaginationItem key={index}>
                                {page === "ellipsis" ? (
                                    <PaginationEllipsis />
                                ) : (
                                    <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            updatePage(page as number);
                                        }}
                                        isActive={currentPage === page}
                                    >
                                        {page}
                                    </PaginationLink>
                                )}
                            </PaginationItem>
                        ))}

                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage < totalPages) {
                                        updatePage(currentPage + 1);
                                    }
                                }}
                                className={
                                    currentPage === totalPages
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayedFlags.map((flag) => (
                    <FlagCard
                        key={flag.index}
                        flagName={flag.flagName}
                        flagImage={flag.flagImage}
                        link={flag.link}
                    />
                ))}
            </div>

            {/* Bottom Pagination */}
            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage > 1) {
                                        updatePage(currentPage - 1);
                                    }
                                }}
                                className={
                                    currentPage === 1
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            />
                        </PaginationItem>

                        {getPageNumbers.map((page, index) => (
                            <PaginationItem key={index}>
                                {page === "ellipsis" ? (
                                    <PaginationEllipsis />
                                ) : (
                                    <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            updatePage(page as number);
                                        }}
                                        isActive={currentPage === page}
                                    >
                                        {page}
                                    </PaginationLink>
                                )}
                            </PaginationItem>
                        ))}

                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (currentPage < totalPages) {
                                        updatePage(currentPage + 1);
                                    }
                                }}
                                className={
                                    currentPage === totalPages
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

            {/* No Results */}
            {filteredFlags.length === 0 && debouncedQuery && (
                <Card>
                    <CardContent className="text-center py-12">
                        <p className="text-gray-500 text-lg">
                            No flags found matching &quot;{debouncedQuery}&quot;
                        </p>
                        <Button
                            variant="default"
                            onClick={() => setSearchQuery("")}
                            className="mt-4"
                        >
                            Clear Search
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* No Favorites */}
            {filteredFlags.length === 0 &&
                !debouncedQuery &&
                activeTab === "favorites" && (
                    <Card>
                        <CardContent className="text-center py-12">
                            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg mb-2">
                                No favorites yet
                            </p>
                            <p className="text-gray-400 text-sm mb-4">
                                Start exploring flags and click the heart icon
                                to add them to your favorites
                            </p>
                            <Button
                                variant="default"
                                onClick={() => setActiveTab("all")}
                            >
                                Browse All Flags
                            </Button>
                        </CardContent>
                    </Card>
                )}
        </div>
    );
}
