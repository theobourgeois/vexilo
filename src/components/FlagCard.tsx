"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Heart, Edit, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import React from "react";
import FlagFieldsForm from "./FlagFieldsForm";

type FlagCardProps = Flag;

export default function FlagCard({
    id,
    flagName,
    flagImage,
    link,
    index,
    tags,
    description,
}: FlagCardProps) {
    const { isFavorite, toggleFavorite } = useFavoritesStore();
    const { data: session } = useSession();
    const [editMode, setEditMode] = React.useState(false);

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const flag: Flag = {
            id: "",
            flagName,
            flagImage,
            link,
            index,
            tags,
            description,
        };
        toggleFavorite(flag);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditMode(!editMode);
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
                        <div className="aspect-[3/2] relative shadow-shadow">
                            <Image
                                style={{
                                    boxShadow: "8px upx 0px 0px var(--border)",
                                }}
                                src={flagImage}
                                alt={flagName}
                                fill
                                className="drop-shadow-shadow object-contain text-main-foreground bg-main/70 border-4 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none p-2 rounded-base"
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

            <DialogContent
                className={
                    editMode
                        ? "md:max-w-2xl h-11/12 overflow-y-auto"
                        : undefined
                }
            >
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>{flagName}</DialogTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="neutral"
                                size="sm"
                                onClick={() => {
                                    const flag: Flag = {
                                        id: "",
                                        flagName,
                                        flagImage,
                                        link,
                                        index,
                                        tags,
                                        description,
                                    };
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
                                {isFavorite(flagName)
                                    ? "Favorited"
                                    : "Favorite"}
                            </Button>
                            {session && (
                                <Button
                                    variant="neutral"
                                    size="sm"
                                    onClick={handleEditClick}
                                    className="flex items-center gap-2 ml-2"
                                >
                                    {editMode ? (
                                        <>
                                            <X className="w-4 h-4" />
                                            Cancel
                                        </>
                                    ) : (
                                        <>
                                            <Edit className="w-4 h-4" />
                                            Edit
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {editMode ? (
                    <FlagFieldsForm
                        initialFlag={{
                            id,
                            flagName,
                            flagImage,
                            link,
                            index,
                            tags,
                            description,
                        }}
                        onCancel={() => setEditMode(false)}
                    />
                ) : (
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

                        {/* Description */}
                        {description && (
                            <p className="text-gray-700 text-center px-2">
                                {description}
                            </p>
                        )}

                        {/* Tags */}
                        {tags && tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center">
                                {tags.map((tag: string) => (
                                    <Badge key={tag} variant="neutral">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}

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
                )}
            </DialogContent>
        </Dialog>
    );
}
