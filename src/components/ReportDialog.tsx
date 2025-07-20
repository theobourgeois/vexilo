"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { createReport } from "@/actions/reports";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface ReportDialogProps {
	flagId: string;
	flagName: string;
	children: React.ReactNode;
}

const REPORT_REASONS = [
	"Inappropriate content",
	"Incorrect information",
	"Poor image quality",
	"Wrong flag",
	"Duplicate flag",
	"Other",
];

export function ReportDialog({
	flagId,
	flagName,
	children,
}: ReportDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [description, setDescription] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!reason) {
			toast.error("Please select a reason for the report");
			return;
		}

		if (!description.trim()) {
			toast.error("Please provide a description");
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await createReport(flagId, reason, description);

			if (result.success) {
				toast.success("Report submitted successfully");
				setIsOpen(false);
				setReason("");
				setDescription("");
			} else {
				toast.error(result.message || "Failed to submit report");
			}
		} catch (error) {
			console.error("Error submitting report:", error);
			toast.error("Failed to submit report");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setReason("");
			setDescription("");
		}
		setIsOpen(open);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="w-5 h-5 text-orange-500" />
						Report Flag
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<p className="text-sm text-muted-foreground mt-1">{flagName}</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="reason">Reason for report *</Label>
						<Select value={reason} onValueChange={setReason}>
							<SelectTrigger className="bg-secondary-background w-full">
								<SelectValue placeholder="Select a reason" />
							</SelectTrigger>
							<SelectContent className="bg-secondary-background">
								{REPORT_REASONS.map((r) => (
									<SelectItem
										className="hover:bg-black/10 cursor-pointer"
										key={r}
										value={r}
									>
										{r}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description *</Label>
						<Textarea
							id="description"
							placeholder="Please provide details about the issue..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={4}
							maxLength={500}
							required
						/>
						<p className="text-xs text-muted-foreground">
							{description.length}/500 characters
						</p>
					</div>

					<div className="flex gap-2 pt-4">
						<Button
							type="button"
							variant="neutral"
							onClick={() => setIsOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting || !reason || !description.trim()}
							className="flex-1"
						>
							{isSubmitting ? "Submitting..." : "Submit Report"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
