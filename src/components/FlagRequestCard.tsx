"use client";

import { approveFlagEditRequest, approveFlagRequest, declineFlagRequest } from "@/actions/requests";
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

// Helper function to compare arrays
function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
}

interface FlagRequestCardProps {
    flagRequest: typeof flagRequests.$inferSelect;
    page: number;
    isEdit: boolean;
}

export function FlagRequestCard({ flagRequest, page, isEdit }: FlagRequestCardProps) {
    const queryClient = useQueryClient();

    const handleApprove = async () => {
        try {
            toast.loading("Approving flag request...");
            let result;
            if(isEdit) {
                result = await approveFlagEditRequest(flagRequest.id);
            } else {
                result = await approveFlagRequest(flagRequest.id);
            }
            
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

    // Render field comparison for edit requests
    const renderFieldComparison = (fieldName: string, oldValue: string | undefined, newValue: string, isImage = false) => {
        const hasChanged = oldValue !== newValue;
        
        if (!isEdit || !hasChanged) {
            return (
                <div>
                    <strong>{fieldName}:</strong>
                    {isImage ? (
                        <div className="mt-2">
                            <div className="relative w-64 h-40 border rounded-lg overflow-hidden bg-gray-100">
                                {newValue && isValidUrl(newValue) ? (
                                    <Image
                                        src={newValue}
                                        alt={fieldName}
                                        fill
                                        className="object-cover"
                                        sizes="256px"
                                        onError={(e) => {
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
                    ) : (
                        <span className="ml-2">{newValue}</span>
                    )}
                </div>
            );
        }

        return (
            <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 p-3 rounded-r-lg">
                <strong>{fieldName} (Changed):</strong>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <Badge variant="neutral" className="mb-2">Old Value</Badge>
                        {isImage ? (
                            <div className="relative w-full aspect-[3/2] border rounded-lg overflow-hidden bg-gray-100">
                                {oldValue && isValidUrl(oldValue) ? (
                                    <Image
                                        src={oldValue}
                                        alt={`Old ${fieldName}`}
                                        fill
                                        className="object-contain h-full w-full"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            target.parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full text-gray-500 text-sm">Image not available</div>';
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">
                                        Image not available
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-gray-600 text-sm break-words">{oldValue || <span className="text-red-500">No value</span>}</div>
                        )}
                    </div>
                    <div>
                        <Badge variant="neutral" className="mb-2">New Value</Badge>
                        {isImage ? (
                            <div className="relative aspect-[3/2] w-full border rounded-lg overflow-hidden bg-gray-100">
                                {newValue && isValidUrl(newValue) ? (
                                    <Image
                                        src={newValue}
                                        alt={`New ${fieldName}`}
                                        fill
                                        className="object-contain h-full w-full"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            target.parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full text-gray-500 text-sm">Image not available</div>';
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">
                                        Image not available
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-gray-600 text-sm break-words">{newValue || <span className="text-red-500">No value</span>}</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{flagRequest.flag.flagName} {isEdit ? <Badge variant="neutral">Edit</Badge> : ""}</span>
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
                {/* Flag Details with Comparison */}
                <div className="space-y-4">
                    {renderFieldComparison("Flag Name", flagRequest.oldFlag?.flagName, flagRequest.flag.flagName)}
                    {renderFieldComparison("Flag Image", flagRequest.oldFlag?.flagImage, flagRequest.flag.flagImage, true)}
                    {renderFieldComparison("Link", flagRequest.oldFlag?.link, flagRequest.flag.link)}
                    {renderFieldComparison("Description", flagRequest.oldFlag?.description, flagRequest.flag.description)}
                    
                    {/* Tags comparison */}
                    <div>
                        <strong>Tags:</strong>
                        {isEdit && flagRequest.oldFlag && !arraysEqual(flagRequest.oldFlag.tags || [], flagRequest.flag.tags) ? (
                            <div className="border-l-4 border-yellow-500 pl-4 bg-yellow-50 p-3 rounded-r-lg mt-2">
                                <Badge variant="neutral" className="mb-2">Changed</Badge>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Badge variant="neutral" className="mb-2">Old Tags</Badge>
                                        <div className="flex flex-wrap gap-1">
                                            {(flagRequest.oldFlag.tags || []).map((tag, index) => (
                                                <Badge key={index} variant="neutral">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Badge variant="neutral" className="mb-2">New Tags</Badge>
                                        <div className="flex flex-wrap gap-1">
                                            {flagRequest.flag.tags.map((tag, index) => (
                                                <Badge key={index} variant="neutral">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {flagRequest.flag.tags.map((tag, index) => (
                                    <Badge key={index} variant="neutral">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
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