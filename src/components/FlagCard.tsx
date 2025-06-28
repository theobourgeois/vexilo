"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type FlagCardProps = {
    flagName: string;
    flagImage: string;
    link: string;
};

export default function FlagCard({ flagName, flagImage, link }: FlagCardProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className="cursor-pointer px-8">
                    <div className="relative overflow-hidden">
                        <div className="aspect-[3/2] relative">
                            <Image
                                src={flagImage}
                                alt={flagName}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                        </div>
                    </div>

                    <CardContent>
                        <h3 className="font-semibold text-center">
                            {flagName}
                        </h3>
                        <Badge className="mt-2">
                            <Info className="w-4 h-4 mr-1" />
                            Click for details
                        </Badge>
                    </CardContent>
                </Card>
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{flagName}</DialogTitle>
                    <DialogDescription>
                        Click the button below to learn more about this
                        flag&apos;s history and symbolism
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <Card className="p-4">
                        <div className="relative aspect-[3/2] w-full">
                            <Image
                                src={flagImage}
                                alt={flagName}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                            />
                        </div>
                    </Card>

                    <Card>
                        <CardHeader>
                            <h4 className="font-semibold">Flag Information</h4>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="font-medium">
                                        Country/Region:
                                    </span>
                                    <p>{flagName}</p>
                                </div>
                                <div>
                                    <span className="font-medium">
                                        Image Source:
                                    </span>
                                    <p>Wikimedia Commons</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild>
                            <Link
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Learn More on Wikipedia
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link
                                href={flagImage}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View Full Size Image
                            </Link>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
