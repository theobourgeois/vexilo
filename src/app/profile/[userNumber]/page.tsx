"use client";

import { getUserFlags } from "@/actions/requests";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import FlagCard from "@/components/FlagCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag, User, ArrowLeft, ArrowRight, Edit } from "lucide-react";
import Link from "next/link";
import { getUserByUserNumber } from "@/actions/users";

export default function ProfilePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const userNumber = params.userNumber as string;
    const page = parseInt(searchParams.get("page") || "1");
    const router = useRouter();
    
    const {data: userData, isLoading: userLoading, error: userError} = useQuery({
        queryKey: ["user", userNumber],
        queryFn: () => getUserByUserNumber(userNumber),
    });

    const {
        data: userFlags,
        isLoading: requestsLoading,
        error: requestsError,
    } = useQuery({
        queryKey: ["flags", userNumber, page],
        queryFn: () => getUserFlags(userNumber, page),
    });

    const flags = userFlags?.flags;
    const totalFlagCount = userFlags?.totalFlagCount;
    const totalEditCount = userFlags?.totalEditCount;

    // Skeletons
    function UserInfoSkeleton() {
        return (
            <Card className="p-6">
                <div className="flex items-center space-x-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
            </Card>
        );
    }

    function FlagsSkeleton() {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full" />
                ))}
            </div>
        );
    }

    // Error handling for user query
    if (userError) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <Card className="p-6">
                    <div className="text-center space-y-4">
                        <div className="text-6xl">👤</div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Oops! Something went wrong
                        </h2>
                        <Button asChild>
                            <Link href="/">Go Home</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    // Error handling for flags query
    if (requestsError) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <Card className="p-6">
                    <div className="text-center space-y-4">
                        <div className="text-6xl">🚩</div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Oops! Something went wrong
                        </h2>
                        <p className="text-muted-foreground">
                            {requestsError.message}
                        </p>
                        <Button asChild>
                            <Link href="/">Go Home</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    // User not found
    if (!userLoading && (!userData?.user)) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <Card className="p-6">
                    <div className="text-center space-y-4">
                        <div className="text-6xl">👤</div>
                        <h2 className="text-2xl font-bold text-foreground">
                            User Not Found
                        </h2>
                        <p className="text-muted-foreground">
                            This user doesn&apos;t exist or their profile is
                            private.
                        </p>
                        <Button asChild>
                            <Link href="/">Go Home</Link>
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const user = userData?.user;
    const totalPages = Math.ceil((totalFlagCount || 0) / 12);

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", page.toString());
        router.replace(`/profile/${userNumber}?${params.toString()}`, { scroll: false });
    }

    function PaginationComponent() {
        if (totalPages > 1) {
            return (
                <div className="flex items-center justify-center gap-4">
                    <Button disabled={page === 1} onClick={() => handlePageChange(page - 1)}>
                        <ArrowLeft className="w-4 h-4" /> Previous
                    </Button>
                    <span className="text-sm">
                        Page {page} of {totalPages}
                    </span>
                    <Button disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}>
                        Next <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="space-y-8">
                {/* User Info Section */}
                {userLoading ? (
                    <UserInfoSkeleton />
                ) : user ? (
                    <Card className="p-6 bg-gradient-to-r from-background to-secondary-background border-2 border-border shadow-shadow">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
                            <Avatar className="h-24 w-24 border-4 border-border shadow-shadow">
                                <AvatarImage
                                    src={user.image || ""}
                                    alt={user.name || "User"}
                                />
                                <AvatarFallback className="text-2xl font-bold bg-main text-main-foreground">
                                    {user.name
                                        ? user.name.charAt(0).toUpperCase()
                                        : "U"}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 text-center sm:text-left space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
                                    <h1 className="text-3xl font-bold text-foreground">
                                        {user.name || "Anonymous User"}
                                    </h1>
                                </div>

                                <div className="flex items-center justify-center sm:justify-start space-x-6 text-sm text-muted-foreground">
                                    <div className="flex items-center space-x-2">
                                        <Flag className="w-4 h-4" />
                                        <span>
                                            {totalFlagCount} flags contributed
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Edit className="w-4 h-4" />
                                        <span>
                                            {totalEditCount} edits contributed
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <User className="w-4 h-4" />
                                        <span>
                                            Member since{" "}
                                            {new Date(
                                                user.createdAt || Date.now()
                                            ).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : null}

                {/* Flags Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-foreground">
                            Flag Collection
                        </h2>
                        <Badge variant="neutral" className="text-sm">
                            {totalFlagCount} flags
                        </Badge>
                    </div>

                    {/* Pagination */}
                    <PaginationComponent />

                    {requestsLoading ? (
                        <FlagsSkeleton />
                    ) : totalFlagCount === 0 ? (
                        <Card className="p-12">
                            <div className="text-center space-y-4">
                                <div className="text-6xl">🏳️</div>
                                <h3 className="text-xl font-semibold text-foreground">
                                    No flags yet
                                </h3>
                                <p className="text-muted-foreground">
                                    This user hasn&apos;t contributed any flags
                                    yet.
                                </p>
                            </div>
                        </Card>
                    ) : flags ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {flags.map((flag, index) => (
                                    <FlagCard
                                        key={`${flag.flagName}-${index}`}
                                        id={flag.id}
                                        flagName={flag.flagName}
                                        flagImage={flag.flagImage}
                                        link={flag.link}
                                        index={flag.index}
                                        tags={flag.tags || []}
                                        description={flag.description || ""}
                                        favorites={flag.favorites}
                                        isFavorite={flag.isFavorite}
                                    />
                                ))}
                            </div>
                            <PaginationComponent />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
