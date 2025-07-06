"use client";
import { getLeaderboard } from "@/actions/leaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getRankStyle } from "@/lib/get-rank-style";

export function Leaderboard() {
    const { data: leaderboard, isLoading } = useQuery({
        queryKey: ["leaderboard"],
        queryFn: () => getLeaderboard(),
    });

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Top Contributors
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(3)].map((_, i) => (
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
        );
    }

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                    Top Contributors
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
                <div className="pt-4  border-gray-200 flex justify-center">
                    <Link href="/leaderboard">
                        <Button variant="neutral" className="w-fit">
                            View More
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
