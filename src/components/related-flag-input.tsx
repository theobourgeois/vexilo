import { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { useQuery } from "@tanstack/react-query";
import { getFlags } from "@/actions/flags";
import { useDebounce } from "use-debounce";
import FlagImage from './FlagImage';
import { RemovablePill } from "./TagInput";
import { Search, Check, Loader2 } from '@/components/icons';
import { cn } from "@/lib/utils";
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
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const handleSelect = (flag: { id: string; name: string; image: string }) => {
		const isAlreadySelected = relatedFlags.some((f) => f.id === flag.id);

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
		return relatedFlags.some((f) => f.id === id);
	};

	return (
		<div className="space-y-1.5" ref={dropdownRef}>
			<div className="relative">
				<Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search for a flag..."
					onChange={(e) => setSearch(e.target.value)}
					value={search}
					className="pl-10"
					onFocus={() => setIsDropdownOpen(true)}
				/>

				{search && isDropdownOpen && (
					<div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-[14px] bg-popover p-1.5 shadow-pop">
						{isLoading ? (
							<div className="flex items-center justify-center py-4 text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
							</div>
						) : recommendations && recommendations.length > 0 ? (
							recommendations.map((flag) => {
								const isSelected = isFlagSelected(flag.id);
								return (
									<button
										key={flag.id}
										type="button"
										aria-pressed={isSelected}
										className="flex w-full cursor-pointer items-center gap-3 rounded-[9px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none"
										onClick={() => handleSelect(flag)}
									>
										<span
											className={cn(
												"grid size-4 shrink-0 place-items-center rounded-[5px]",
												isSelected ? "bg-main text-main-foreground" : "vx-well",
											)}
										>
											{isSelected && <Check className="size-3" />}
										</span>
										<span className="flex w-9 shrink-0 justify-center">
											<FlagImage src={flag.image} alt={flag.name} maxHeight={20} fixed />
										</span>
										<span className="truncate font-medium">{flag.name}</span>
									</button>
								);
							})
						) : (
							<div className="py-4 text-center text-[13px] text-muted-foreground">
								No flags found
							</div>
						)}
					</div>
				)}
			</div>

			{relatedFlags.length > 0 && (
				<div className="flex flex-wrap gap-1.5 pt-1">
					{relatedFlags.map((link) => (
						<RemovablePill
							key={link.id}
							onRemove={() => handleRemoveLink(link.id)}
							removeLabel={`Remove ${link.name}`}
							className="pl-1.5"
						>
							<FlagImage src={link.image} alt="" maxHeight={14} fixed />
							<span className="truncate">{link.name}</span>
						</RemovablePill>
					))}
				</div>
			)}
		</div>
	);
}
