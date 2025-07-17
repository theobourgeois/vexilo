import { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { useQuery } from "@tanstack/react-query";
import { getFlags } from "@/actions/flags";
import { useDebounce } from "use-debounce";
import Image from "next/image";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Search, X, Check } from "lucide-react";
import { RelatedFlag } from "@/lib/types";

type FlagLinkSearchInputProps = {
	onAdd: (flag: RelatedFlag) => void;
	onRemove: (link: string) => void;
	relatedFlags: RelatedFlag[];
};

export default function RelatedFlagInput({
	onAdd,
	onRemove,
	relatedFlags,
}: FlagLinkSearchInputProps) {
	const [search, setSearch] = useState("");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const [debouncedSearch] = useDebounce(search, 500);

	const { data: recommendations, isLoading } = useQuery({
		queryKey: ["flag-link-search", debouncedSearch],
		queryFn: () => getFlags(1, 10, debouncedSearch),
		enabled: debouncedSearch.length > 0,
	});

	// Handle clicking outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	const handleSelect = (flag: {
		id: string;
		name: string;
		image: string;
	}) => {
		const isAlreadySelected = relatedFlags.some(f => f.id === flag.id);
		
		if (isAlreadySelected) {
			onRemove(flag.id);
		} else {
			onAdd({
				name: flag.name,
				image: flag.image,
				id: flag.id,
			});
		}
	};

	const handleRemoveLink = (idToRemove: string) => {
		onRemove(idToRemove);
	};

	const isFlagSelected = (id: string) => {
		return relatedFlags.some(f => f.id === id);
	};

	return (
		<div className="space-y-1.5" ref={dropdownRef}>
			{/* Search Input */}
			<div className="relative">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
					<Input
						placeholder="Search for a flag..."
						onChange={(e) => setSearch(e.target.value)}
						value={search}
						className="pl-10 pr-4"
						onFocus={() => setIsDropdownOpen(true)}
					/>
				</div>

				{/* Search Results Dropdown */}
				{search && isDropdownOpen && (
					<Card className="absolute top-full left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto shadow-lg border-2">
						<CardContent className="p-2">
							{isLoading ? (
								<div className="flex items-center justify-center py-4">
									<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
								</div>
							) : recommendations && recommendations.length > 0 ? (
								<div className="space-y-0">
									{recommendations
										.map((flag) => {
											const isSelected = isFlagSelected(flag.name);
											return (
												<div
													key={flag.id}
													className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary-background transition-colors cursor-pointer"
													onClick={() => handleSelect(flag)}
												>
													<div className="flex-shrink-0 w-4 h-4 border-2 border-border rounded flex items-center justify-center bg-background">
														{isSelected && (
															<Check className="h-3 w-3 text-primary" />
														)}
													</div>
													<div className="relative w-8 h-6 rounded overflow-hidden border border-border flex-shrink-0">
														<Image
															src={flag.image}
															alt={flag.name}
															fill
															className="object-cover"
														/>
													</div>
													<span className="font-medium text-sm">{flag.name}</span>
												</div>
											);
										})}
								</div>
							) : (
								<div className="text-center py-4 text-muted-foreground text-sm">
									No flags found
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</div>

			{/* Selected Links */}
			{relatedFlags.length > 0 && (
				<div className="space-y-2">
					<div className="flex flex-wrap gap-1">
						{relatedFlags.map((link) => (
							<Badge
								key={link.id}
								variant="neutral"
								className="flex items-center gap-2 px-3 py-1.5"
							>
								<div className="relative w-4 h-3 rounded overflow-hidden border border-border">
									<Image
										src={link.image}
										alt={link.name}
										fill
										className="object-cover"
									/>
								</div>
								<span className="text-xs font-medium">{link.name}</span>
								<Button
									variant="noShadow"
									size="icon"
									className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
									onClick={() => handleRemoveLink(link.id)}
								>
									<X className="h-3 w-3" />
								</Button>
							</Badge>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
