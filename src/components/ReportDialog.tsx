"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createReport } from "@/actions/reports";
import { toast } from "sonner";
import { Loader2 } from '@/components/icons';
import { cn } from "@/lib/utils";
import { toastErrorWithLogin } from "@/lib/toast-auth";

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
				toastErrorWithLogin(result.message || "Failed to submit report");
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
			<DialogContent className="sm:max-w-[460px]">
				<DialogHeader>
					<DialogTitle className="text-[17px] font-semibold tracking-[-0.02em]">
						Report flag
					</DialogTitle>
					<DialogDescription className="text-[13px] text-muted-foreground">
						Tell the moderators what&apos;s wrong with{" "}
						<span className="font-medium text-foreground">{flagName}</span>.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<fieldset className="space-y-1.5">
						<legend className="mb-1.5 text-[13px] font-medium">Reason</legend>
						<div className="grid gap-1.5 sm:grid-cols-2">
							{REPORT_REASONS.map((r) => {
								const selected = reason === r;
								return (
									<label
										key={r}
										className={cn(
											"flex h-10 cursor-pointer items-center gap-2.5 rounded-[11px] px-3 text-[13px] transition-shadow has-[:focus-visible]:shadow-[var(--sh-well),0_0_0_2px_var(--main)]",
											selected
												? "bg-well font-medium text-foreground shadow-[var(--sh-well),inset_0_0_0_1.5px_var(--main)]"
												: "vx-well text-subtle hover:text-foreground",
										)}
									>
										<input
											type="radio"
											name="report-reason"
											value={r}
											checked={selected}
											onChange={() => setReason(r)}
											className="sr-only"
										/>
										<span
											aria-hidden
											className={cn(
												"grid size-4 shrink-0 place-items-center rounded-full",
												selected
													? "bg-main"
													: "shadow-[inset_0_0_0_1.5px_var(--border)]",
											)}
										>
											{selected && <span className="size-1.5 rounded-full bg-white" />}
										</span>
										{r}
									</label>
								);
							})}
						</div>
					</fieldset>

					<div className="space-y-1.5">
						<label htmlFor="description" className="block text-[13px] font-medium">
							Details
						</label>
						<Textarea
							id="description"
							placeholder="What should be fixed?"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={4}
							maxLength={500}
							required
						/>
						<p className="text-right tabular-nums text-[11px] text-muted-foreground">
							{description.length}/500
						</p>
					</div>

					<div className="flex justify-end gap-2 pt-1">
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
						>
							{isSubmitting && <Loader2 className="animate-spin" />}
							{isSubmitting ? "Sending" : "Send report"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
