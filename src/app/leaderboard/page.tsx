"use client";
import { getFullLeaderboard } from "@/actions/leaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getRankStyle } from "@/lib/get-rank-style";

export default function LeaderboardPage() {
    const { data: leaderboard, isLoading } = useQuery({
        queryKey: ["fullLeaderboard"],
        queryFn: getFullLeaderboard,
    });

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-main/10 pt-4">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="mb-6">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Home
                        </Link>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                                <Trophy className="h-8 w-8 text-yellow-500" />
                                Top 100 Contributors
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                    <Skeleton className="h-6 w-16" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-main/10 pt-4 pb-4">
            <div className="max-w-4xl mx-auto px-4">
                <div className="mb-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                            <Trophy className="h-8 w-8 text-yellow-500" />
                            Top 100 Contributors
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {leaderboard?.map((item, index) => {
                            const style = getRankStyle(index);
                            const user = item.user;
                            const contributions = item.leaderboard.contributions;

                            return (
                                <div
                                    key={item.leaderboard.id}
                                    className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${style.card}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                    <AvatarImage
                                                        src={user?.image || "/logo.svg"}
                                                    />
                                                    <AvatarFallback className="text-sm font-semibold">
                                                        {user?.isAnonymous
                                                            ? "A"
                                                            : user?.name
                                                            ? getInitials(user.name)
                                                            : "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <Badge
                                                    className={`absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center ${style.badge}`}
                                                >
                                                    {style.icon}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col">
                                                <Link
                                                    href={`/profile/${user?.userNumber}`}
                                                    className="hover:underline"
                                                >
                                                    <span className="font-semibold">
                                                        {user?.isAnonymous
                                                            ? "Anonymous User"
                                                            : user?.name ||
                                                              "Unknown User"}
                                                    </span>
                                                </Link>
                                                <span
                                                    className={`text-sm font-medium ${style.rankColor}`}
                                                >
                                                    {style.rank} Place
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold">
                                                {contributions}
                                            </div>
                                            <div className="text-xs text-muted">
                                                contributions
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 