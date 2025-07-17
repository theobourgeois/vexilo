"use client";

import { Heart, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavoriteFlag, deleteFlag } from "@/actions/flags";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import React from "react";
import { useSession } from "next-auth/react";
import FlagFieldsForm from "@/components/FlagFieldsForm";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { RelatedFlag } from "@/lib/types";

type FlagActionsProps = {
    flag: {
        id: string;
        name: string;
        image: string;
        link: string;
        index: number;
        tags: string[];
        description: string;
        favorites?: number;
        isFavorite?: boolean;
        relatedFlags?: RelatedFlag[];
    };
};

export default function FlagActions({ flag }: FlagActionsProps) {
    const queryClient = useQueryClient();
    const session = useSession();
    const router = useRouter();
    const [isFavorite, setIsFavorite] = React.useState(
        flag.isFavorite || false
    );
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    const handleFavoriteToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session.data?.user) {
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
            if (!isSuccess) {
                setIsFavorite(false);
            }
        });
    };

    const handleEditClick = (e: React.MouseEvent) => {
        if (!session.data?.user) {
            toast.error("You must be logged in to edit a flag");
            return;
        }
        e.stopPropagation();
        setIsDialogOpen(true);
    };

    const handleDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session.data?.user?.isAdmin) {
            toast.error("You must be an admin to delete flags");
            return;
        }

        const isSuccess = await deleteFlag(flag.id);
        if (isSuccess) {
            toast.success("Flag deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["flags"] });
            router.push("/");
        } else {
            toast.error("Failed to delete flag");
        }
    };

    return (
        <div className="flex items-center gap-2 justify-center">
            <Button
                variant="neutral"
                size="sm"
                onClick={handleFavoriteToggle}
                className="flex items-center gap-2"
            >
                <Heart
                    className={`w-4 ${
                        isFavorite ? "fill-red-500" : "text-gray-600"
                    }`}
                />
                {isFavorite ? "Favorited" : "Favorite"}
            </Button>
            {session && (
                <Dialog
                    open={isDialogOpen}
                    onOpenChange={(val) => {
                        if (session.data?.user) {
                            setIsDialogOpen(val);
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button
                            variant="neutral"
                            size="sm"
                            onClick={handleEditClick}
                            className="flex items-center gap-2 ml-2"
                        >
                            <Edit className="w-4 h-4" />
                            Edit
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-[60vw]! h-11/12 overflow-y-auto">
                        <FlagFieldsForm
                            initialFlag={{
                                id: flag.id,
                                flagName: flag.name,
                                flagImage: flag.image,
                                link: flag.link,
                                index: flag.index,
                                tags: flag?.tags,
                                description: flag.description,
                                relatedFlags: flag.relatedFlags,
                            }}
                            onCancel={() => setIsDialogOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
            {session.data?.user?.isAdmin && (
                <Button
                    variant="neutral"
                    size="sm"
                    onClick={handleDeleteClick}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white border-red-50"
                >
                    <Trash2 className="w-4 h-4" />
                    Delete
                </Button>
            )}
        </div>
    );
}
