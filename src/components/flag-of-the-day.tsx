"use client";
import { Card, CardHeader, CardContent, CardFooter } from "./ui/card";
import FlagCard from "./FlagCard";
import { useQuery } from "@tanstack/react-query";
import { getFlagOfTheDay } from "@/actions/flags";
import { Skeleton } from "./ui/skeleton";

export function FlagOfTheDay() {
    const { data: flagOfTheDay } = useQuery({
        queryKey: ["flagOfTheDay"],
        queryFn: async () => {
            return await getFlagOfTheDay().then((flag) => {
                return {
                    flagName: flag.name,
                    flagImage: flag.image,
                    link: flag.link,
                    index: flag.index,
                    tags: flag.tags,
                    description: flag.description,
                    id: flag.id,
                    isFavorite: flag.isFavorite,
                    favorites: flag.favorites,
                };
            });
        },
    });

    if (!flagOfTheDay) {
        return (
            <Skeleton className="h-full w-full" />
        )
    }

    return (
            <Card className="h-full">
                <CardHeader className="text-2xl font-bold mb-4 text-center">
                    Flag of the Day
                </CardHeader>
                <CardContent>
                    <FlagCard
                        id={flagOfTheDay.id}
                        tags={flagOfTheDay.tags}
                        description={flagOfTheDay.description}
                        flagName={flagOfTheDay.flagName}
                        flagImage={flagOfTheDay.flagImage}
                        link={flagOfTheDay.link}
                        index={flagOfTheDay.index}
                        isFavorite={flagOfTheDay.isFavorite}
                        favorites={flagOfTheDay.favorites}
                    />
                </CardContent>
                <CardFooter>
                    <p className="text-center mt-4 text-sm">
                        Come back tomorrow for a new flag!
                    </p>
                </CardFooter>
            </Card>
    );
}
