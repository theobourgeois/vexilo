"use client";

import { createAdminFlags } from "@/actions/flags";
import { getFlagRequests } from "@/actions/requests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FlagRequestCard } from "@/components/FlagRequestCard";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Suspense } from "react";

function Requests({ page }: { page: number }) {
    const { data: flagRequests } = useQuery({
        queryKey: ["flagRequests", page],
        queryFn: async () => {
            return getFlagRequests(page, 10);
        },
    });

    return (
        <div className="flex flex-col gap-2">
            {flagRequests?.map((flagRequest) => (
                <FlagRequestCard
                    key={flagRequest.id}
                    flagRequest={flagRequest}
                    page={page}
                />
            ))}
        </div>
    );
}

function Pagination({ page }: { page: number }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", newPage.toString());
        router.push(`/admin?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-4 mt-4">
            <Button
                variant="neutral"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
            >
                Previous
            </Button>
            <span className="text-sm text-muted-foreground">
                Page {page}
            </span>
            <Button
                variant="neutral"
                onClick={() => handlePageChange(page + 1)}
            >
                Next
            </Button>
        </div>
    );
}

function AdminContent() {
    const auth = useSession();
    const isAdmin = auth.data?.user?.isAdmin;
    const searchParams = useSearchParams();
    const page = Number(searchParams.get("page")) || 1;

    if (!isAdmin) {
        return <div>Unauthorized</div>;
    }

    const handleImportFlags = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                try {
                    const flags = JSON.parse(text);

                    console.log(flags.slice(0, 10));
                    if (flags.length > 0) {
                        toast.loading("Importing flags...");
                        createAdminFlags(flags)
                            .then(() => {
                                toast.dismiss();
                                toast.success("Flags imported successfully");
                            })
                            .catch((error) => {
                                toast.dismiss();
                                toast.error(
                                    `Error importing flags: ${
                                        error.message || "Unknown error"
                                    }`
                                );
                                console.error(error);
                            });
                    }
                } catch (parseError) {
                    toast.error("Error parsing JSON file");
                    console.error(parseError);
                }
            };
            reader.onerror = () => {
                toast.error("Error reading file");
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="min-h-screen bg-main/10 w-screen">
            <div className="max-w-7xl mx-auto px-4 gap-2 flex flex-col items-start justify-start py-4">
                <h1 className="text-4xl font-bold">Admin Page</h1>
                <div className="w-full space-y-2">
                    <Input
                        className="w-min"
                        type="file"
                        onChange={handleImportFlags}
                    />
                    <Requests page={page} />
                    <Pagination page={page} />
                </div>
            </div>
        </div>
    );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminContent />
        </Suspense>
    );
}
