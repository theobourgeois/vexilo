"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import FlagCard from "./FlagCard";

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

    // Initialize search query from URL
    const initialQuery = searchParams.get("q") || "";
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
    const [displayedFlags, setDisplayedFlags] = useState<Flag[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Configure Fuse.js for fuzzy search
    const fuse = useMemo(() => {
        return new Fuse(flags, {
            keys: ["flagName"],
            threshold: 0.3,
            includeScore: true,
        });
    }, [flags]);

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

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Filter flags based on debounced search query
    const filteredFlags = useMemo(() => {
        if (!debouncedQuery.trim()) {
            return flags;
        }
        const results = fuse.search(debouncedQuery);
        return results.map((result) => result.item);
    }, [debouncedQuery, fuse, flags]);

    // Load more flags for infinite scroll
    const loadMoreFlags = useCallback(() => {
        setIsLoading(true);
        setTimeout(() => {
            const newFlags = filteredFlags.slice(
                0,
                currentPage * ITEMS_PER_PAGE
            );
            setDisplayedFlags(newFlags);
            setIsLoading(false);
        }, 100);
    }, [filteredFlags, currentPage]);

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
        setDisplayedFlags(filteredFlags.slice(0, ITEMS_PER_PAGE));
    }, [filteredFlags]);

    // Load more when scrolling
    useEffect(() => {
        const handleScroll = () => {
            if (
                window.innerHeight + document.documentElement.scrollTop >=
                document.documentElement.offsetHeight - 1000
            ) {
                if (
                    displayedFlags.length < filteredFlags.length &&
                    !isLoading
                ) {
                    setCurrentPage((prev) => prev + 1);
                }
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [displayedFlags.length, filteredFlags.length, isLoading]);

    // Load more flags when page changes
    useEffect(() => {
        if (currentPage > 1) {
            loadMoreFlags();
        }
    }, [currentPage, loadMoreFlags]);

    return (
        <div className="space-y-6">
            {/* Search Header */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                type="text"
                                placeholder="Search flags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="text-sm text-gray-500">
                            {filteredFlags.length} of {flags.length} flags
                            {searchQuery !== debouncedQuery && (
                                <span className="ml-2 text-blue-500">
                                    (searching...)
                                </span>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </Card>

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

            {/* Loading Indicator */}
            {isLoading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-500">Loading more flags...</p>
                </div>
            )}

            {/* End of Results */}
            {displayedFlags.length >= filteredFlags.length &&
                filteredFlags.length > 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <p>You&apos;ve reached the end of the results</p>
                    </div>
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
        </div>
    );
}
