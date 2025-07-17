import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag, Star, Eye } from "lucide-react";

export default function FlagLoading() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="text-center space-y-4 mb-8">
                <Badge variant="neutral" className="mb-2">
                    <Flag className="w-4 h-4 mr-1" />
                    <Skeleton className="h-4 w-16" />
                </Badge>
                <Skeleton className="h-12 w-3/4 mx-auto" />
                <Skeleton className="h-6 w-2/3 mx-auto" />
            </div>

            {/* Actions - positioned prominently below header */}
            <div className="flex justify-center mb-8">
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>

            {/* Flag Display - Full Width */}
            <Card className="mb-8">
                <CardContent className="p-6">
                    <div className="relative aspect-[3/2] md:w-3/4 mx-auto w-full rounded-lg overflow-hidden">
                        <Skeleton className="w-full h-full" />
                    </div>
                </CardContent>
            </Card>

            {/* View Options */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-center flex items-center justify-center gap-2">
                        <Eye className="w-5 h-5" />
                        View Options
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>

            {/* Related Flags */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Star className="w-5 h-5" />
                        Related Flags
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="aspect-[3/2] mb-3">
                                        <Skeleton className="w-full h-full" />
                                    </div>
                                    <Skeleton className="h-4 w-3/4 mb-2" />
                                    <Skeleton className="h-3 w-1/2" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}