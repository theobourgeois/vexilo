"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Users, Flag, Heart, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CommunityGuidelinesPage() {
    const router = useRouter();

    const handleBackToHome = () => {
        router.push("/");
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Community Guidelines
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Help us maintain a respectful and inclusive community
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Shield className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle>Our Mission</CardTitle>
                                <CardDescription>
                                    We&apos;re building a community that celebrates flags and their cultural significance
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Vexilo is a platform for flag enthusiasts to share, discover, and learn about flags from around the world. 
                            We believe in fostering a respectful environment where everyone can contribute meaningfully to our shared passion.
                        </p>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Heart className="h-6 w-6 text-green-600" />
                                </div>
                                <CardTitle>What We Encourage</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">High-quality flag images</p>
                                        <p className="text-sm text-muted-foreground">Clear, well-lit photos or vector graphics</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Accurate information</p>
                                        <p className="text-sm text-muted-foreground">Proper flag names, countries, and historical context</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Educational content</p>
                                        <p className="text-sm text-muted-foreground">Share interesting facts and flag history</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Respectful discussions</p>
                                        <p className="text-sm text-muted-foreground">Engage in constructive conversations about flags</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <CardTitle>What We Don&apos;t Allow</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Offensive or inappropriate content</p>
                                        <p className="text-sm text-muted-foreground">No hate speech, discrimination, or harmful material</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Copyright violations</p>
                                        <p className="text-sm text-muted-foreground">Only share images you have permission to use</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Spam or self-promotion</p>
                                        <p className="text-sm text-muted-foreground">No excessive posting or commercial content</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="font-medium">Misinformation</p>
                                        <p className="text-sm text-muted-foreground">Ensure all flag information is accurate</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Flag className="h-6 w-6 text-purple-600" />
                            </div>
                            <CardTitle>Flag Submission Guidelines</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <h4 className="font-semibold">Image Requirements</h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>• High resolution (minimum 300x200 pixels)</li>
                                    <li>• Clear, unobstructed view of the flag</li>
                                    <li>• Proper aspect ratio and proportions</li>
                                    <li>• SVG format preferred for crisp scaling</li>
                                </ul>
                            </div>
                            <div className="space-y-3">
                                <h4 className="font-semibold">Content Requirements</h4>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>• Accurate flag name and country/region</li>
                                    <li>• Proper source attribution</li>
                                    <li>• Relevant tags for easy discovery</li>
                                    <li>• Brief description or historical context</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Users className="h-6 w-6 text-blue-600" />
                            </div>
                            <CardTitle>Leaderboard Participation</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                When you post a flag, you may appear on our community leaderboard, which displays your username and profile picture. 
                                This helps showcase active contributors and celebrate our community members.
                            </p>
                            <div className="flex items-start gap-3 p-3 bg-blue-100/50 rounded-lg">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                    <p className="text-sm font-medium">Want to update your display name?</p>
                                    <p className="text-sm text-muted-foreground">
                                        You can edit your username anytime in your <a href="/settings" className="text-blue-600 hover:underline">settings page</a>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Users className="h-6 w-6 text-orange-600" />
                            </div>
                            <CardTitle>Community Standards</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold mb-2">Be Respectful</h4>
                                <p className="text-sm text-muted-foreground">
                                    Remember that flags represent nations, regions, and communities. Treat all flags and their cultural significance with respect, even if they&apos;re not from your own background.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Be Accurate</h4>
                                <p className="text-sm text-muted-foreground">
                                    Double-check your information before posting. If you&apos;re unsure about a flag&apos;s details, do your research or ask the community for help.
                                </p>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Be Helpful</h4>
                                <p className="text-sm text-muted-foreground">
                                    Share your knowledge and help others learn. If you see incorrect information, politely correct it with reliable sources.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                <div className="flex justify-center pt-6">
                    <Button
                        variant="neutral"
                        onClick={handleBackToHome}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Button>
                </div>
            </div>
        </div>
    );
} 