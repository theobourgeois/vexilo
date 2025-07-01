"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Heart } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFavoritesStore } from "../store/favorites";
import { Flag } from "@/lib/types";

type FlagCardProps = Flag;

export default function FlagCard({ flagName, flagImage, link, index, tags, description }: FlagCardProps) {
    const { isFavorite, toggleFavorite } = useFavoritesStore();

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const flag: Flag = { flagName, flagImage, link, index, tags, description };
        toggleFavorite(flag);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className="cursor-pointer px-8 relative group">
                    {/* Favorite Button */}
                    <Button
                        variant="neutral"
                        size="sm"
                        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white"
                        onClick={handleFavoriteClick}
                    >
                        <Heart
                            className={`w-4 h-4 ${
                                isFavorite(flagName)
                                    ? "fill-red-500 text-red-500"
                                    : "text-gray-600"
                            }`}
                        />
                    </Button>

                    <div className="relative overflow-hidden">
                        <div className="aspect-[3/2] relative">
                            <Image
                                src={flagImage}
                                alt={flagName}
                                fill
                                className="object-contain"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                        </div>
                    </div>

                    <CardContent className="pb-2">
                        <h3 className="font-semibold text-center">
                            <Link
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                {flagName}
                            </Link>
                        </h3>
                    </CardContent>
                </Card>
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>{flagName}</DialogTitle>
                        </div>
                        <Button
                            variant="neutral"
                            size="sm"
                            onClick={() => {
                                const flag: Flag = { flagName, flagImage, link, index, tags, description };
                                toggleFavorite(flag);
                            }}
                            className="flex items-center gap-2"
                        >
                            <Heart
                                className={`w-4 h-4 ${
                                    isFavorite(flagName)
                                        ? "fill-red-500 text-red-500"
                                        : "text-gray-600"
                                }`}
                            />
                            {isFavorite(flagName) ? "Favorited" : "Favorite"}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    <Card className="p-4">
                        <div className="relative aspect-[3/2] w-full">
                            <Image
                                src={flagImage}
                                alt={flagName}
                                fill
                                className="object-contain"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                            />
                        </div>
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild>
                            <Link
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Learn More
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link
                                href={flagImage}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View Full Size Image
                            </Link>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
