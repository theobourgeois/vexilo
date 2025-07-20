import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getTopFlagTags, getAllFlagTags } from "@/actions/flags";
import { useDebounce } from "use-debounce";
import { Card, CardContent } from "./ui/card";

type TagInputProps = {
	tags: string[];
	onTagsChange: (tags: string[]) => void;
	placeholder?: string;
	label?: string;
};

export default function TagInput({
	tags,
	onTagsChange,
	placeholder = "Add a tag...",
	label = "Tags",
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
		if (!tags.includes(selectedTag)) {
			onTagsChange([...tags, selectedTag]);
		}
		setInputValue("");
		setIsDropdownOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const trimmedValue = inputValue.trim();
			if (trimmedValue && !tags.includes(trimmedValue)) {
				onTagsChange([...tags, trimmedValue]);
				setInputValue("");
				setIsDropdownOpen(false);
			}
		}
	};

	const isTagSelected = (tag: string) => {
		return tags.includes(tag);
	};

	// Get suggestions to show (filtered tags if searching, top tags otherwise)
	const suggestions = debouncedSearch.length > 0 ? filteredTags?.tags : topTags;

	return (
		<div className="space-y-2" ref={dropdownRef}>
			<label htmlFor="tags" className="text-sm font-semibold">
				{label}
			</label>
			<div className="space-y-3">
				<div className="relative">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
						<Input
							id="tags"
							placeholder={placeholder}
							value={inputValue}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							className="pl-10 pr-4"
						/>
					</div>

					{/* Tag Suggestions Dropdown */}
					{isDropdownOpen && (
						<Card className="p-0 absolute top-full left-0 right-0 z-50 max-h-60 overflow-y-auto shadow-lg border-2 bg-secondary-background">
							<CardContent className="p-2">
								{isLoading ? (
									<div className="flex items-center justify-center py-4">
										<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
									</div>
								) : (
									<div className="space-y-0">
										{suggestions
											?.filter((suggestion) => !isTagSelected(suggestion.tag))
											?.slice(0, 10)
											?.map((suggestion) => (
												<button
													key={suggestion.tag}
													type="button"
													className="flex items-center gap-3 p-2 hover:bg-secondary-background transition-colors cursor-pointer w-full text-left"
													onClick={() => handleTagSelect(suggestion.tag)}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															handleTagSelect(suggestion.tag);
														}
													}}
												>
													<span className="font-medium text-sm">
														{suggestion.tag}
													</span>
													<span className="text-xs text-muted-foreground ml-auto">
														{suggestion.count}
													</span>
												</button>
											))}

										{/* Add new tag option */}
										{inputValue.trim() &&
											!suggestions?.some(
												(s) =>
													s.tag.toLowerCase() ===
													inputValue.trim().toLowerCase(),
											) &&
											!tags.includes(inputValue.trim()) && (
												<button
													type="button"
													className="flex items-center gap-3 p-2 hover:bg-secondary-background transition-colors cursor-pointer w-full text-left border-t border-border"
													onClick={() => handleTagSelect(inputValue.trim())}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															handleTagSelect(inputValue.trim());
														}
													}}
												>
													<span className="font-medium text-sm text-primary">
														Add &ldquo;{inputValue.trim()}&rdquo;
													</span>
												</button>
											)}
									</div>
								)}
							</CardContent>
						</Card>
					)}
				</div>
				{tags.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{tags.map((tag) => (
							<Badge key={tag} variant="neutral" className="gap-1">
								{tag}
								<button
									type="button"
									onClick={() => removeTag(tag)}
									className="ml-1 hover:bg-foreground/10 rounded-full p-0.5"
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
