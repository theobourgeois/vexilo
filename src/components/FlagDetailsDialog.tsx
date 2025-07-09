"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Heart, Edit, X, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import React from "react";
import FlagFieldsForm from "./FlagFieldsForm";
import { toggleFavoriteFlag, deleteFlag } from "@/actions/flags";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type FlagDetailsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    flag: {
        id: string;
        flagName: string;
        flagImage: string;
        link: string;
        index: number;
        tags: string[];
        description: string;
        favorites?: number;
        isFavorite?: boolean;
    };
    showEditControls?: boolean;
};

export default function FlagDetailsDialog({
    open,
    onOpenChange,
    flag,
    showEditControls = true,
}: FlagDetailsDialogProps) {
    const { data: session } = useSession();
    const [editMode, setEditMode] = React.useState(false);
    const queryClient = useQueryClient();
    const [isFavorite, setIsFavorite] = React.useState(flag.isFavorite || false);

    const handleFavoriteToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session?.user) {
            toast.error("You must be logged in to favorite a flag");
            return;
        }
        if (isFavorite) {
            setIsFavorite(false);
        } else {
            setIsFavorite(true);
        }
        toggleFavoriteFlag(flag.id).then((isSuccess) => {
            queryClient.invalidateQueries({ queryKey: ["flags"] });
            if(!isSuccess) {
                setIsFavorite(false);
            }
        });
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditMode(!editMode);
    };

    const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session?.user?.isAdmin) {
            toast.error("You must be an admin to delete flags");
            return;
        }
        
        const isSuccess = await deleteFlag(flag.id);
        if (isSuccess) {
            toast.success("Flag deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["flags"] });
            onOpenChange(false);
        } else {
            toast.error("Failed to delete flag");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={
                    editMode
                        ? "md:max-w-2xl max-h-11/12 overflow-y-auto"
                        : undefined
                }
            >
                <DialogHeader>
                    <div className="flex flex-col gap-2">
                        <div>
                            <DialogTitle>{flag.flagName}</DialogTitle>
                        </div>
                        {showEditControls && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="neutral"
                                    size="sm"
                                    onClick={handleFavoriteToggle}
                                    className="flex items-center gap-2"
                                >
                                    <Heart
                                        className={`w-4 h-4 ${
                                            isFavorite
                                                ? "fill-red-500 text-red-500"
                                                : "text-gray-600"
                                        }`}
                                    />
                                    {isFavorite ? "Favorited" : "Favorite"}
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
                                {session?.user?.isAdmin && (
                                    <Button
                                        variant="neutral"
                                        size="sm"
                                        onClick={handleDeleteClick}
                                        className="flex items-center gap-2 ml-2 bg-red-500 hover:bg-red-600 text-white border-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {editMode ? (
                    <FlagFieldsForm
                        initialFlag={{
                            id: flag.id,
                            flagName: flag.flagName,
                            flagImage: flag.flagImage,
                            link: flag.link,
                            index: flag.index,
                            tags: flag.tags,
                            description: flag.description,
                        }}
                        onCancel={() => setEditMode(false)}
                    />
                ) : (
                    <div className="space-y-6">
                        <Card className="p-4">
                            <div className="relative aspect-[3/2] w-full">
                                <Image
                                    src={flag.flagImage}
                                    alt={flag.flagName}
                                    fill
                                    className="object-contain"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                                />
                            </div>
                        </Card>

                        {/* Description */}
                        {flag.description && (
                            <p className="text-center px-2">{flag.description}</p>
                        )}

                        {/* Tags */}
                        {flag.tags && flag.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 justify-center">
                                {flag.tags.map((tag: string) => (
                                    <Badge key={tag} variant="neutral">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button asChild>
                                <Link
                                    href={flag.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Learn More
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link
                                    href={flag.flagImage}
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