import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Upload, Loader2 } from "lucide-react";
import { Flag, RelatedFlag } from "@/lib/types";
import { toast } from "sonner";
import { createFlagRequest } from "@/actions/requests";
import { Textarea } from "./ui/textarea";
import { blobUrlToBase64 } from "@/lib/blob-to-url";
import RelatedFlagInput from "./related-flag-input";
import { Badge } from "./ui/badge";
import { X } from "lucide-react";

type FlagFieldsFormProps = {
	initialFlag: Omit<Flag, "index"> & { index?: number };
	onCancel: () => void;
};

export default function FlagFieldsForm({
	initialFlag,
	onCancel,
}: FlagFieldsFormProps) {
	const [flagName, setFlagName] = useState(initialFlag.flagName || "");
	const [description, setDescription] = useState(initialFlag.description || "");
	const [link, setLink] = useState(initialFlag.link || "");
	const [flagImage, setFlagImage] = useState(initialFlag.flagImage || "");
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState(initialFlag.flagImage || "");
	const [fileType, setFileType] = useState<string | null>(null);
	const [userMessage, setUserMessage] = useState("");
	const [relatedFlags, setRelatedFlags] = useState<RelatedFlag[]>(
		initialFlag.relatedFlags || [],
	);
	const [tags, setTags] = useState<string[]>(initialFlag.tags || []);
	const [tagInput, setTagInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleAddRelatedFlag = (flag: RelatedFlag) => {
		setRelatedFlags([...relatedFlags, flag]);
	};

	const handleRemoveRelatedFlag = (id: string) => {
		setRelatedFlags(relatedFlags.filter((f) => f.id !== id));
	};

	const addTag = (tag: string) => {
		const trimmedTag = tag.trim();
		if (trimmedTag && !tags.includes(trimmedTag)) {
			setTags([...tags, trimmedTag]);
			setTagInput("");
		}
	};

	const removeTag = (tagToRemove: string) => {
		setTags(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleTagKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			addTag(tagInput);
		}
	};

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		if (file) {
			setFileType(file.type);
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
			setFlagImage(url);
			setImageFile(file);
		}
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith("image/")) {
			setFileType(file.type);
			setImageFile(file);
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
			setFlagImage(url);
		}
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
	};

	const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const url = e.target.value;
		setFlagImage(url);
		if (url.trim()) {
			setPreviewUrl(url);
			setImageFile(null);
		} else {
			setPreviewUrl("");
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		try {
			const flag = {
				flagName: flagName,
				flagImage: flagImage || imageFile?.name || "",
				link: link,
				description: description,
				relatedFlags: relatedFlags,
				tags: tags,
			};
			if (flag.flagImage.startsWith("blob:")) {
				const contentType = fileType || "image/jpeg";
				flag.flagImage = await blobUrlToBase64(flag.flagImage, contentType);
			}

			const result = await createFlagRequest(flag, initialFlag.id, userMessage);
			if (result.success) {
				toast.success("Flag update request sent! Please wait for approval.");
			} else {
				toast.error(result.message);
			}
			onCancel();
		} catch (error) {
			console.error(error);
			toast.error("An error occurred while posting the flag.");
		} finally {
			setIsLoading(false);
		}
	};

	const isChangeMade = useMemo(() => {
		return (
			flagName !== initialFlag.flagName ||
			description !== initialFlag.description ||
			link !== initialFlag.link ||
			flagImage !== initialFlag.flagImage ||
			JSON.stringify(relatedFlags) !== JSON.stringify(initialFlag.relatedFlags) ||
			JSON.stringify(tags) !== JSON.stringify(initialFlag.tags)
		);

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		flagName,
		description,
		link,
		flagImage,
		initialFlag.description,
		relatedFlags,
		tags,
	]);

	return (
		<form onSubmit={handleSubmit} className="space-y-6 w-full">
			<div className=" gap-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<label htmlFor="flagName" className="text-sm font-semibold">
							Flag Title
						</label>
						<Input
							id="flagName"
							placeholder="Enter the flag title..."
							className="w-full"
							value={flagName}
							onChange={(e) => setFlagName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="link" className="text-sm font-semibold">
							Source
						</label>
						<Input
							id="link"
							placeholder="Enter the source or reference..."
							className="w-full"
							value={link}
							onChange={(e) => setLink(e.target.value)}
						/>
					</div>
				</div>
				<div>
					<div className="space-y-2">
						<label htmlFor="description" className="text-sm font-semibold">
							Description
						</label>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							id="description"
							placeholder="Describe the flag, its history, or any interesting facts..."
						/>
					</div>
				</div>
				{/* TAGS INPUT */}
				<div className="space-y-2">
					<label htmlFor="tags" className="text-sm font-semibold">
						Tags
					</label>
					<div className="space-y-3">
						<div className="flex gap-2">
							<Input
								id="tags"
								placeholder="Enter tags..."
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyPress={handleTagKeyPress}
								className="flex-1"
							/>
							<Button
								variant="neutral"
								onClick={() => addTag(tagInput)}
								disabled={!tagInput.trim()}
							>
								Add
							</Button>
						</div>
						{tags.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{tags.map((tag) => (
									<Badge key={tag} variant="neutral" className="gap-1">
										{tag}
										<button
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
			</div>
			<div className="space-y-2">
				<label htmlFor="flagImage" className="text-sm font-semibold">
					Flag Image
				</label>
				<div className="space-y-4">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div
							className="border-2 border-dashed border-main rounded-lg p-6 text-center bg-secondary-background hover:bg-secondary-background/80 transition-colors"
							onDrop={handleDrop}
							onDragOver={handleDragOver}
						>
							<Upload className="mx-auto h-12 w-12 text-muted-foreground" />
							<div className="mt-4">
								<input
									type="file"
									id="file-upload"
									accept="image/*,.svg"
									onChange={handleImageChange}
									className="hidden"
								/>
								<label
									htmlFor="file-upload"
									className="cursor-pointer inline-block"
								>
									<Button variant="neutral" className="mb-2" asChild>
										<span>Choose File</span>
									</Button>
								</label>
								{imageFile && (
									<p
										className="text-sm truncate text-green-600 mb-2"
										title={imageFile.name}
									>
										✓ {imageFile.name}
									</p>
								)}
								<p className="text-sm text-muted-foreground">
									Drag and drop an image here, or click to browse
								</p>
							</div>
						</div>
						{previewUrl && (
							<div className="space-y-2 flex-col h-full">
								<div className="border rounded-lg p-4 bg-secondary-background flex-1 h-full flex items-center justify-center">
									<Image
										width={100}
										height={100}
										src={previewUrl}
										alt="Flag preview"
										className="max-w-full h-auto max-h-64 mx-auto rounded"
										onError={() => setPreviewUrl("")}
									/>
								</div>
							</div>
						)}
					</div>
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground text-center">- or -</p>
						<div className="space-y-2">
							<Input
								placeholder="Paste image URL here..."
								value={flagImage}
								onChange={handleImageUrlChange}
								className="w-full"
							/>
						</div>
					</div>
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="space-y-2">
					<label htmlFor="userMessage" className="text-sm font-semibold">
						Message
					</label>
					<Textarea
						id="userMessage"
						placeholder="Enter a message for the admin..."
						value={userMessage}
						onChange={(e) => setUserMessage(e.target.value)}
						className="w-full"
					/>
				</div>
				<div>
					<label htmlFor="userMessage" className="text-sm font-semibold">
						Related Flags
					</label>
					<RelatedFlagInput
						relatedFlags={relatedFlags}
						onAdd={handleAddRelatedFlag}
						onRemove={handleRemoveRelatedFlag}
					/>
				</div>
			</div>
			<div className="flex gap-4 pt-4">
				<Button
					className="flex-1"
					type="submit"
					disabled={!isChangeMade || isLoading}
				>
					{isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
				</Button>
				<Button
					variant="neutral"
					className="flex-1"
					type="button"
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
