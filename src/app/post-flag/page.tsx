"use client";

import { useSession } from "next-auth/react";
import { GoogleSignin } from "@/components/google-signin";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import {
    Loader2,
    Upload,
    X,
    CheckCircle,
    ArrowLeft,
    Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createFlagRequest } from "@/actions/requests";
import Image from "next/image";
import Link from "next/link";

async function blobUrlToBase64(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = "data:image/jpeg;base64," + base64String.split(",")[1];
          resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
  });
}

export default function PostFlagPage() {
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [isPosted, setIsPosted] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [title, setTitle] = useState("");
    const [source, setSource] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [description, setDescription] = useState("");
    const router = useRouter();

    // Check if all required fields are filled
    const isFormValid =
        title.trim() !== "" &&
        source.trim() !== "" &&
        (image !== null || imageUrl.trim() !== "");

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
        // get url from file
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setImageUrl(url);
            setImage(file);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            setImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setImageUrl(url);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setImageUrl(url);

        if (url.trim()) {
            setPreviewUrl(url);
            setImage(null); // Clear file input when URL is entered
        } else {
            setPreviewUrl("");
        }
    };

    const handlePost = async () => {
        setIsLoading(true);

        try {
            const flag = {
                flagName: title,
                flagImage: imageUrl || image?.name || "",
                link: source,
                tags: tags,
                description: description,
            };
            if (flag.flagImage.startsWith("blob:")) {
                flag.flagImage = await blobUrlToBase64(flag.flagImage);
            }

            const result = await createFlagRequest(flag);
            if (result.success) {
                setIsPosted(true);
                toast.success("Flag posted successfully!", {
                    description: "Your flag has been submitted for review.",
                });
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while posting the flag.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateAnother = () => {
        setIsPosted(false);
        setTags([]);
        setTagInput("");
        setTitle("");
        setSource("");
        setImage(null);
        setImageUrl("");
        setPreviewUrl("");
    };

    const handleBackToHome = () => {
        router.push("/");
    };

    if (status === "loading") {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12">
                <Card className="w-full max-w-md mx-auto">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                            <Image
                                src="/logo.svg"
                                alt="Vexilo Logo"
                                width={120}
                                height={120}
                                className="object-contain w-44 h-44"
                            />
                        </div>
                        <CardTitle className="text-2xl">
                            Sign in to Post a Flag
                        </CardTitle>
                        <CardDescription>
                            You need to be signed in to share flags with the
                            community
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col items-center">
                        <GoogleSignin />
                        <p className="text-sm text-muted-foreground text-center">
                            By signing in, you agree to our <Link href="/community-guidelines" className="text-main hover:underline">community guidelines</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isPosted) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-12">
                <Card className="w-full max-w-md mx-auto">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl">
                            Flag Submitted!
                        </CardTitle>
                        <CardDescription>
                            Your flag is under review. Thank you for
                            contributing to our community!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <Button
                                className="flex-1"
                                onClick={handleCreateAnother}
                            >
                                Create Another
                            </Button>
                            <Button
                                variant="neutral"
                                className="flex-1"
                                onClick={handleBackToHome}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Home
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Post a Flag
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Share a flag with the community
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Flag Details</CardTitle>
                        <CardDescription>
                            Fill in the details about the flag you want to share
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label
                                htmlFor="title"
                                className="text-sm font-semibold"
                            >
                                Flag Title
                            </label>
                            <Input
                                id="title"
                                placeholder="Enter the flag title..."
                                className="w-full"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="description"
                                className="text-sm font-semibold"
                            >
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                id="description"
                                placeholder="Describe the flag, its history, or any interesting facts..."
                                className="flex w-full min-h-[100px] rounded-base border-2 border-border bg-secondary-background selection:bg-main selection:text-main-foreground px-3 py-2 text-sm font-base text-foreground placeholder:text-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="source"
                                className="text-sm font-semibold"
                            >
                                Source
                            </label>
                            <Input
                                id="source"
                                placeholder="Enter the source or reference..."
                                className="w-full"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="tags"
                                className="text-sm font-semibold"
                            >
                                Tags
                            </label>
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        id="tags"
                                        placeholder="Enter tags..."
                                        value={tagInput}
                                        onChange={(e) =>
                                            setTagInput(e.target.value)
                                        }
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
                                            <Badge
                                                key={tag}
                                                variant="neutral"
                                                className="gap-1"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() =>
                                                        removeTag(tag)
                                                    }
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

                        <div className="space-y-2">
                            <label
                                htmlFor="image"
                                className="text-sm font-semibold"
                            >
                                Flag Image
                            </label>
                            <Alert className="mb-4 mt-2">
                                <Info />
                                <AlertTitle>
                                    Image Quality Guidelines
                                </AlertTitle>
                                <AlertDescription>
                                    Upload a high-quality image of the flag. SVG
                                    format is preferred for crisp, scalable
                                    graphics that look great at any size.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-4">
                                {/* File Upload */}
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
                                            <Button
                                                variant="neutral"
                                                className="mb-2"
                                                asChild
                                            >
                                                <span>Choose File</span>
                                            </Button>
                                        </label>
                                        {image && (
                                            <p className="text-sm text-green-600 mb-2">
                                                ✓ {image.name}
                                            </p>
                                        )}
                                        <p className="text-sm text-muted-foreground">
                                            Drag and drop an image here, or
                                            click to browse
                                        </p>
                                    </div>
                                </div>

                                {/* Image Preview */}
                                {previewUrl && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold">
                                            Preview
                                        </p>
                                        <div className="border rounded-lg p-4 bg-secondary-background">
                                            <Image
                                                width={100}
                                                height={100}
                                                src={previewUrl}
                                                alt="Flag preview"
                                                className="max-w-full h-auto max-h-64 mx-auto rounded"
                                                onError={() => {
                                                    setPreviewUrl("");
                                                    toast.error(
                                                        "Failed to load image. Please check the URL or try a different image."
                                                    );
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Image URL Input */}
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground text-center">
                                        - or -
                                    </p>
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Paste image URL here..."
                                            value={imageUrl}
                                            onChange={handleImageUrlChange}
                                            className="w-full"
                                        />
                                        {imageUrl && !previewUrl && (
                                            <p className="text-sm text-yellow-600">
                                                Loading image...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                className="flex-1"
                                disabled={isLoading || !isFormValid}
                                onClick={handlePost}
                            >
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Post Flag
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
