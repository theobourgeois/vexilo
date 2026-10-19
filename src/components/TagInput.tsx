import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { X, Search, Plus, Loader2, Lock } from '@/components/icons';
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getTopFlagTags, getAllFlagTags } from "@/actions/flags";
import { useDebounce } from "use-debounce";

type TagInputProps = {
	tags: string[];
	onTagsChange: (tags: string[]) => void;
	placeholder?: string;
	label?: string;
	lockedTags?: string[];
	maxTags?: number;
};

export default function TagInput({
	tags,
	onTagsChange,
	placeholder = "Add a tag...",
	label = "Tags",
	lockedTags = [],
	maxTags,
}: TagInputProps) {
	const [inputValue, setInputValue] = useState("");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const [debouncedSearch] = useDebounce(inputValue, 300);

	// Get top tags for initial suggestions
	const { data: topTags } = useQuery({
		queryKey: ["top-flag-tags"],
		queryFn: () => getTopFlagTags(20),
	});

	// Get filtered tags based on search
	const { data: filteredTags, isLoading } = useQuery({
		queryKey: ["filtered-flag-tags", debouncedSearch],
		queryFn: () => getAllFlagTags(debouncedSearch),
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

	const removeTag = (tagToRemove: string) => {
		const newTags = tags.filter((tag) => tag !== tagToRemove);
		onTagsChange(newTags);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);
		setIsDropdownOpen(value.length > 0);
	};

	const handleTagSelect = (selectedTag: string) => {
		if (!isTagSelected(selectedTag) && (maxTags === undefined || tags.length < maxTags)) {
			onTagsChange([...tags, selectedTag]);
		}
		setInputValue("");
		setIsDropdownOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const trimmedValue = inputValue.trim();
			if (trimmedValue) handleTagSelect(trimmedValue);
		}
	};

	const isTagSelected = (tag: string) => {
		return [...tags, ...lockedTags].some((value) => value.toLowerCase() === tag.toLowerCase());
	};

	// Get suggestions to show (filtered tags if searching, top tags otherwise)
	const suggestions = debouncedSearch.length > 0 ? filteredTags?.tags : topTags;

	return (
		<div className="space-y-1.5" ref={dropdownRef}>
			<label htmlFor="tags" className="block text-[13px] font-medium">
				{label}
			</label>
			<div className="relative">
				<Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					id="tags"
					maxLength={40}
					disabled={maxTags !== undefined && tags.length >= maxTags}
					placeholder={placeholder}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					className="pl-10"
				/>

				{isDropdownOpen && (
					<div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-60 overflow-y-auto rounded-[14px] bg-popover p-1.5 shadow-pop">
						{isLoading ? (
							<div className="flex items-center justify-center py-4 text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
							</div>
						) : (
							<>
								{suggestions
									?.filter((suggestion) => !isTagSelected(suggestion.tag))
									?.slice(0, 10)
									?.map((suggestion) => (
										<button
											key={suggestion.tag}
											type="button"
											className="flex w-full cursor-pointer items-center gap-3 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none"
											onClick={() => handleTagSelect(suggestion.tag)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													handleTagSelect(suggestion.tag);
												}
											}}
										>
											<span className="truncate font-medium">{suggestion.tag}</span>
											<span className="ml-auto tabular-nums text-[11px] text-muted-foreground">
												{suggestion.count}
											</span>
										</button>
									))}

								{inputValue.trim() &&
									!suggestions?.some(
										(s) =>
											s.tag.toLowerCase() ===
											inputValue.trim().toLowerCase(),
									) &&
									!isTagSelected(inputValue.trim()) && (
										<button
											type="button"
											className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-[9px] border-t border-line px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none"
											onClick={() => handleTagSelect(inputValue.trim())}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													handleTagSelect(inputValue.trim());
												}
											}}
										>
											<Plus className="size-3.5 text-muted-foreground" />
											Add &ldquo;{inputValue.trim()}&rdquo;
										</button>
									)}
							</>
						)}
					</div>
				)}
			</div>
			{(tags.length > 0 || lockedTags.length > 0) && (
				<div className="flex flex-wrap gap-1.5 pt-1">
					{lockedTags.map((tag) => <span key={tag} className='inline-flex h-[26px] items-center gap-1 rounded-full bg-[rgb(225_120_50/0.13)] px-2.5 text-[12.5px] font-semibold text-[#b4541d] dark:bg-[rgb(240_163_107/0.14)] dark:text-[#f0a36b]' title='Automatically added to flags made in the editor'><Lock className='size-3' />{tag}</span>)}
					{tags.map((tag) => (
						<RemovablePill key={tag} onRemove={() => removeTag(tag)} removeLabel={`Remove tag ${tag}`}>
							{tag}
						</RemovablePill>
					))}
				</div>
			)}
		</div>
	);
}

/** Quiet outline pill (matches the `Tag` outline variant) with a remove button. */
export function RemovablePill({
	children,
	onRemove,
	removeLabel,
	title,
	className,
}: {
	children: React.ReactNode;
	onRemove: () => void;
	removeLabel: string;
	title?: string;
	className?: string;
}) {
	return (
		<span
			title={title}
			className={cn(
				"inline-flex h-[26px] max-w-full items-center gap-1.5 rounded-full pl-2.5 pr-1 text-[12.5px] font-medium text-subtle shadow-[inset_0_0_0_1px_var(--border)]",
				className,
			)}
		>
			<span className="flex min-w-0 items-center gap-1.5 truncate">{children}</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={removeLabel}
				className="grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<X className="size-3" />
			</button>
		</span>
	);
}
