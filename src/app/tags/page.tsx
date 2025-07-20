"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllFlagTags } from "@/actions/flags";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Tag from "@/components/Tag";
import { Loader2 } from "lucide-react";

export default function TagsPage() {
	const [search, setSearch] = useState("");
	const { data: tags, isLoading } = useQuery({
		queryKey: ["allFlagTags", search],
		queryFn: () => getAllFlagTags(search),
	});

	return (
		<div className="max-w-4xl mx-auto px-4 py-12">
			<div className="space-y-6">
				<div className="text-center">
					<h1 className="text-3xl font-bold tracking-tight mb-2">All Tags</h1>
					<p className="text-muted-foreground mt-2 mb-4">
						Browse and search all tags used on Vexilo
					</p>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Search Tags</CardTitle>
						<Input
							placeholder="Search tags..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="mt-2"
						/>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : (
							<div className="flex flex-wrap gap-2 items-center">
								{tags && tags.length > 0 ? (
									tags.map((tag) => (
										<Tag key={tag.tag} text={tag.tag} count={tag.count} />
									))
								) : (
									<div className="text-muted-foreground py-8 w-full text-center">
										No tags found.
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
