"use client";
import { getLeaderboard } from "@/actions/leaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Trophy, Medal, Star, Award, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

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

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: // 1st place
                return {
                    card: "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200",
                    badge: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white",
                    icon: <Trophy className="h-4 w-4" />,
                    rank: "1st",
                    rankColor: "text-yellow-600",
                };
            case 1: // 2nd place
                return {
                    card: "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200",
                    badge: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
                    icon: <Medal className="h-4 w-4" />,
                    rank: "2nd",
                    rankColor: "text-gray-600",
                };
            case 2: // 3rd place
                return {
                    card: "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200",
                    badge: "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
                    icon: <Award className="h-4 w-4" />,
                    rank: "3rd",
                    rankColor: "text-orange-600",
                };
            case 3: // 4th place
                return {
                    card: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
                    badge: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
                    icon: <Star className="h-4 w-4" />,
                    rank: "4th",
                    rankColor: "text-blue-600",
                };
            case 4: // 5th place
                return {
                    card: "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200",
                    badge: "bg-gradient-to-r from-purple-500 to-violet-500 text-white",
                    icon: <Zap className="h-4 w-4" />,
                    rank: "5th",
                    rankColor: "text-purple-600",
                };
            default:
                return {
                    card: "bg-white border-gray-200",
                    badge: "bg-gray-500 text-white",
                    icon: <Star className="h-4 w-4" />,
                    rank: `${index + 1}th`,
                    rankColor: "text-gray-600",
                };
        }
    };

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
                                            <span className="font-semibold text-gray-900">
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
                                    <div className="text-2xl font-bold text-gray-900">
                                        {contributions}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        contributions
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="pt-4 border-t border-gray-200 flex justify-center">
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
