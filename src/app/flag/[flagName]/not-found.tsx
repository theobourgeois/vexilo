"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Flag } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="max-w-2xl mx-auto text-center">
                {/* Main Content */}
                <Card className="p-8 border-2 border-border shadow-shadow bg-secondary-background">
                    <div className="space-y-6">
                        {/* Error Number */}
                        <div className="space-y-2">
                            <h1 className="text-8xl font-bold text-main animate-bounce">
                                404
                            </h1>
                            <h2 className="text-2xl font-heading text-foreground">
                                Flag Not Found
                            </h2>
                        </div>

                        {/* Message */}
                        <div className="space-y-4">
                            <p className="text-lg text-foreground/80 max-w-md mx-auto">
                                Oops! It looks like this flag has sailed away or doesn&apos;t exist in our collection yet.
                            </p>
                            <p className="text-sm text-foreground/60">
                                Don&apos;t worry, there are plenty of other amazing flags to discover!
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                            <Link href="/">  
                            <Button
                                className="w-full sm:w-auto"
                                size="lg"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </Button>
                            </Link>
                            <Link href="/post-flag">
                                <Button
                                    variant="neutral"
                                    className="w-full sm:w-auto"
                                    size="lg"
                                >
                                    <Flag className="w-4 h-4" />
                                    Submit a Flag
                                </Button>
                            </Link>
                        </div>

                       
                    </div>
                </Card>

                {/* Decorative Elements */}
                <div className="mt-8 flex justify-center space-x-4 opacity-30">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                    <div className="w-3 h-3 bg-white rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                </div>

               
            </div>
        </div>
    );
}
