"use client";

import { approveFlagRequest, declineFlagRequest } from "@/actions/requests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { flagRequests } from "@/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";

// Helper function to validate URLs
function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

interface FlagRequestCardProps {
    flagRequest: typeof flagRequests.$inferSelect;
    page: number;
}

export function FlagRequestCard({ flagRequest, page }: FlagRequestCardProps) {
    const queryClient = useQueryClient();

    const handleApprove = async () => {
        try {
            toast.loading("Approving flag request...");
            const result = await approveFlagRequest(flagRequest.id);
            
            if (result === true) {
                toast.dismiss();
                toast.success("Flag request approved successfully!");
                // Invalidate and refetch the flag requests
                queryClient.invalidateQueries({ queryKey: ["flagRequests", page] });
            } else if (result === null) {
                toast.dismiss();
                toast.error("Unauthorized to approve flag requests");
            } else {
                toast.dismiss();
                toast.error("Failed to approve flag request");
            }
        } catch (error) {
            toast.dismiss();
            toast.error(`Error approving flag request: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    const handleDecline = async () => {
        try {
            toast.loading("Declining flag request...");
            const result = await declineFlagRequest(flagRequest.id);
            
            if (result === true) {
                toast.dismiss();
                toast.success("Flag request declined successfully!");
                // Invalidate and refetch the flag requests
                queryClient.invalidateQueries({ queryKey: ["flagRequests", page] });
            } else if (result === null) {
                toast.dismiss();
                toast.error("Unauthorized to decline flag requests");
            } else {
                toast.dismiss();
                toast.error("Failed to decline flag request");
            }
        } catch (error) {
            toast.dismiss();
            toast.error(`Error declining flag request: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{flagRequest.flag.flagName}</span>
                    <div className="flex gap-2">
                        <Button 
                            onClick={handleApprove}
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Approve
                        </Button>
                        <Button 
                            onClick={handleDecline}
                            variant="default"
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Decline
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Flag Image */}
                <div className="flex justify-center">
                    <div className="relative w-64 h-40 border rounded-lg overflow-hidden bg-gray-100">
                        {flagRequest.flag.flagImage && isValidUrl(flagRequest.flag.flagImage) ? (
                            <Image
                                src={flagRequest.flag.flagImage}
                                alt={flagRequest.flag.flagName}
                                fill
                                className="object-cover"
                                sizes="256px"
                                onError={(e) => {
                                    // Fallback to placeholder on error
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full text-gray-500">Image not available</div>';
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full text-gray-500">
                                Image not available
                            </div>
                        )}
                    </div>
                </div>

                {/* Flag Details */}
                <div className="space-y-2">
                    <div>
                        <strong>Link:</strong>
                        <a 
                            href={flagRequest.flag.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 ml-2 break-all"
                        >
                            {flagRequest.flag.link}
                        </a>
                    </div>
                    
                    <div>
                        <strong>Description:</strong>
                        <p className="mt-1 text-gray-700">{flagRequest.flag.description}</p>
                    </div>
                    
                    <div>
                        <strong>Tags:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {flagRequest.flag.tags.map((tag, index) => (
                                <Badge key={index} variant="neutral">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Request Info */}
                <div className="pt-4 border-t">
                    <div className="text-sm text-gray-500">
                        <div>Request ID: {flagRequest.id}</div>
                        <div>User ID: {flagRequest.userId}</div>
                        <div>Created: {new Date(flagRequest.createdAt).toLocaleString()}</div>
                        <div>Updated: {new Date(flagRequest.updatedAt).toLocaleString()}</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 