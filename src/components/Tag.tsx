"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import React from "react";

interface TagProps {
	text: string;
	className?: string;
	count?: number;
	onClick?: () => void;
	isActive?: boolean;
}

export default function Tag({
	text,
	className,
	count,
	onClick,
	isActive: isActiveProp,
}: TagProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const isActive = isActiveProp || searchParams.get("tag") === text;

	const handleClick = (e: React.MouseEvent) => {
		if (onClick) {
			onClick();
			return;
		}
		e.preventDefault();
		const params = new URLSearchParams(searchParams);
		params.set("tag", text);
		if (window.location.pathname !== "/") {
			router.push(`/?${params.toString()}`);
			// After navigation, scroll to search-header
			setTimeout(() => {
				const searchHeader = document.getElementById("search-header");
				if (searchHeader) {
					searchHeader.scrollIntoView({ behavior: "smooth" });
				}
			}, 500);
		} else {
			router.replace(`${window.location.pathname}?${params.toString()}`, {
				scroll: false,
			});
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn("focus:outline-none group", className)}
			aria-label={`Filter by tag ${text}`}
		>
			<Badge
				variant="neutral"
				className={cn(
					"transition-colors cursor-pointer group-hover:bg-main group-hover:text-main-foreground group-focus:bg-main group-focus:text-main-foreground border border-border px-3 py-1 rounded-full text-xs font-medium shadow-sm",
					isActive && "bg-main text-main-foreground",
				)}
			>
				#{text} {count ? `(${count})` : ""}
			</Badge>
		</button>
	);
}
