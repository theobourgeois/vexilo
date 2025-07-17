"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flag } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import React from "react";
import { toggleFavoriteFlag } from "@/actions/flags";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type FlagCardProps = Flag;

export default function FlagCard({
	id,
	flagName,
	flagImage,
	favorites,
	isFavorite: initialIsFavorite,
}: FlagCardProps) {
	const { data: session } = useSession();
	const [favoriteCount, setFavoriteCount] = React.useState(favorites || 0);
	const queryClient = useQueryClient();
	const [isFavorite, setIsFavorite] = React.useState(
		initialIsFavorite || false,
	);
	const router = useRouter();

	const handleFavoriteToggle = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!session?.user) {
			toast.error("You must be logged in to favorite a flag");
			return;
		}
		if (isFavorite) {
			setFavoriteCount((prev) => prev - 1);
			setIsFavorite(false);
		} else {
			setFavoriteCount((prev) => prev + 1);
			setIsFavorite(true);
		}
		toggleFavoriteFlag(id).then((isSuccess) => {
			queryClient.invalidateQueries({ queryKey: ["flags"] });
			if (!isSuccess) {
				setFavoriteCount((prev) => prev - 1);
				setIsFavorite(false);
			}
		});
	};

	const handleCardClick = () => {
		router.push(`/flag/${encodeURIComponent(flagName)}`);
	};

	return (
		<Card
			className="cursor-pointer px-8 relative group"
			onClick={handleCardClick}
		>
			{/* Favorite Button - Only visible on hover */}
			<Button
				variant="neutral"
				size="sm"
				className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white shadow-md border border-gray-200 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
				onClick={handleFavoriteToggle}
			>
				<Heart
					className={`w-4 h-4 ${
						isFavorite ? "fill-red-500 text-red-500" : "text-gray-600"
					}`}
				/>
			</Button>

			{/* Favorites Count Badge */}
			{Boolean(favoriteCount) && (
				<div className="absolute top-2 left-2 z-10">
					<Badge
						variant="neutral"
						className="bg-white/90 text-gray-700 border border-gray-200"
					>
						<Heart className="w-3 h-3 mr-1 fill-red-500 text-red-500" />
						{favoriteCount}
					</Badge>
				</div>
			)}

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
				<h3 className="font-semibold text-center">{flagName}</h3>
			</CardContent>
		</Card>
	);
}
