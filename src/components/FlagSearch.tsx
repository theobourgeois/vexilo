"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Heart, X, ArrowRight } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import FlagCard from "./FlagCard";
import { useFavoritesStore } from "../store/favorites";
import { useQuery } from "@tanstack/react-query";
import { getFlags, getFlagsCount } from "@/actions/flags";

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
    onPageChange 
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
    const { favorites } = useFavoritesStore();

    // Local state for search query with debouncing
    const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
    const [debouncedQuery, setDebouncedQuery] = useState(
        searchParams.get("q") || ""
    );

    // Pagination controlled by URL
    const currentPage = parseInt(searchParams.get("page") || "1", 10);
    const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");

    const { data: flags, isLoading: flagsLoading } = useQuery({
        queryKey: ["flags", currentPage, debouncedQuery],
        queryFn: async () => {
            return await getFlags(currentPage, ITEMS_PER_PAGE, debouncedQuery).then((flags) => {
                return flags.map((flag) => ({
                    flagName: flag.name,
                    flagImage: flag.image,
                    link: flag.link,
                    index: flag.index,
                    tags: flag.tags,
                    description: flag.description,
                }));
            });
        },
    });

    const { data: flagsCount } = useQuery({
        queryKey: ["flagsCount", debouncedQuery],
        queryFn: async () => {
            return await getFlagsCount(debouncedQuery);
        },
    });

    const {data: totalFlags} = useQuery({
        queryKey: ["totalFlags"],
        queryFn: async () => {
            return await getFlagsCount("");
        },
    });

    // Get flags based on active tab
    const getFlagsForTab = useCallback(() => {
        if (activeTab === "favorites") {
            return favorites;
        }
        return flags || [];
    }, [activeTab, flags, favorites]);

    // Get filtered flags for display
    const filteredFlags = useMemo(() => {
        return getFlagsForTab() || [];
    }, [getFlagsForTab]);

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
        [router, searchParams]
    );

    const totalPages = Math.ceil((flagsCount || 0) / ITEMS_PER_PAGE);

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
                                {flagsCount || 0} of{" "}
                                {totalFlags || 0} flags
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
            <SimplePagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={updatePage}
            />

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {flagsLoading ? (
                    // Show skeleton loading states
                    Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                        <FlagCardSkeleton key={`skeleton-${index}`} />
                    ))
                ) : (
                    // Show actual flags
                    filteredFlags.map((flag) => (
                        <FlagCard
                            key={flag.index}
                            flagName={flag.flagName}
                            flagImage={flag.flagImage}
                            link={flag.link}
                            index={flag.index}
                            tags={flag.tags}
                            description={flag.description}
                        />
                    ))
                )}
            </div>

            {/* Bottom Pagination */}
            <SimplePagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={updatePage}
            />

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
