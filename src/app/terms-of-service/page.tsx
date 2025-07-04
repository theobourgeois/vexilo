"use client";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, FileText, Users, Flag } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermsOfServicePage() {
    const router = useRouter();

    const handleBackToHome = () => {
        router.push("/");
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Terms of Service
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Last updated: {new Date().toLocaleDateString()}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                            <CardTitle>Acceptance of Terms</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            By accessing and using Vexilo, you accept and agree to be bound by the terms and provision of this agreement. 
                            If you do not agree to abide by the above, please do not use this service.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Users className="h-6 w-6 text-green-600" />
                            </div>
                            <CardTitle>User Accounts and Privacy</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Account Information</h4>
                            <p className="text-sm text-muted-foreground">
                                You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Public Display Consent</h4>
                            <p className="text-sm text-muted-foreground">
                                By using Vexilo, you agree that your username and profile picture may be displayed publicly on our leaderboards, 
                                community features, and other public areas of the platform. This includes but is not limited to:
                            </p>
                            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                                <li>• Community leaderboards showing top contributors</li>
                                <li>• Public flag submissions with attribution</li>
                                <li>• Community engagement features</li>
                                <li>• Platform promotional materials (with appropriate context)</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Privacy Controls</h4>
                            <p className="text-sm text-muted-foreground">
                                You can manage your privacy settings in your account settings page, including options to update your display name 
                                and control your visibility in public features.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Flag className="h-6 w-6 text-purple-600" />
                            </div>
                            <CardTitle>Content Guidelines</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">User-Generated Content</h4>
                            <p className="text-sm text-muted-foreground">
                                You retain ownership of content you submit to Vexilo, but you grant us a license to use, display, and distribute 
                                your content in connection with the service.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Prohibited Content</h4>
                            <p className="text-sm text-muted-foreground">
                                You agree not to submit content that is illegal, harmful, threatening, abusive, defamatory, or violates any 
                                third-party rights. We reserve the right to remove content that violates these terms.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Copyright and Attribution</h4>
                            <p className="text-sm text-muted-foreground">
                                You must have the right to share any flag images you submit. Proper attribution must be provided for all content 
                                that is not your original work.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Shield className="h-6 w-6 text-orange-600" />
                            </div>
                            <CardTitle>Service Limitations</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Service Availability</h4>
                            <p className="text-sm text-muted-foreground">
                                We strive to maintain service availability but cannot guarantee uninterrupted access. We may modify, suspend, 
                                or discontinue the service at any time.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Limitation of Liability</h4>
                            <p className="text-sm text-muted-foreground">
                                Vexilo is provided &quot;as is&quot; without warranties. We are not liable for any damages arising from your use of the service.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Termination</h4>
                            <p className="text-sm text-muted-foreground">
                                We may terminate or suspend your account at any time for violations of these terms. You may also terminate 
                                your account at any time through your settings.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Changes to Terms</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            We may update these terms from time to time. We will notify users of significant changes via email or through 
                            the platform. Continued use of the service after changes constitutes acceptance of the new terms.
                        </p>
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