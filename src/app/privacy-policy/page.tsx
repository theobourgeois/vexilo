"use client";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Eye, Database, Users, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPolicyPage() {
    const router = useRouter();

    const handleBackToHome = () => {
        router.push("/");
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Privacy Policy
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Last updated: {new Date().toLocaleDateString()}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Shield className="h-6 w-6 text-blue-600" />
                            </div>
                            <CardTitle>Your Privacy Matters</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            At Vexilo, we are committed to protecting your privacy and being transparent about how we collect, 
                            use, and share your information. This policy explains our practices regarding your personal data.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Database className="h-6 w-6 text-green-600" />
                            </div>
                            <CardTitle>Information We Collect</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Account Information</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Email address (for authentication and communication)</li>
                                <li>• Display name and profile picture</li>
                                <li>• Authentication provider information (Google, etc.)</li>
                                <li>• Account preferences and settings</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Content You Submit</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Flag images and descriptions</li>
                                <li>• Comments and community interactions</li>
                                <li>• User-generated content and metadata</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Usage Information</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Pages visited and features used</li>
                                <li>• Search queries and preferences</li>
                                <li>• Device and browser information</li>
                                <li>• IP address and general location data</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Eye className="h-6 w-6 text-purple-600" />
                            </div>
                            <CardTitle>How We Use Your Information</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Service Provision</h4>
                            <p className="text-sm text-muted-foreground">
                                We use your information to provide, maintain, and improve our flag discovery platform, 
                                including user authentication, content management, and community features.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Public Display</h4>
                            <p className="text-sm text-muted-foreground">
                                Your username and profile picture may be displayed publicly on:
                            </p>
                            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                                <li>• Community leaderboards</li>
                                <li>• Flag submission attributions</li>
                                <li>• User activity feeds</li>
                                <li>• Community engagement features</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Communication</h4>
                            <p className="text-sm text-muted-foreground">
                                We may use your email to send important service updates, security notifications, 
                                and respond to your inquiries. You can opt out of promotional communications.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Analytics and Improvement</h4>
                            <p className="text-sm text-muted-foreground">
                                We analyze usage patterns to improve our service, develop new features, 
                                and ensure platform security and performance.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Users className="h-6 w-6 text-orange-600" />
                            </div>
                            <CardTitle>Information Sharing</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Public Information</h4>
                            <p className="text-sm text-muted-foreground">
                                Your username, profile picture, and submitted content are publicly visible 
                                to other users of the platform as part of the community experience.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Service Providers</h4>
                            <p className="text-sm text-muted-foreground">
                                We may share information with trusted third-party service providers who help us 
                                operate our platform (hosting, analytics, authentication, etc.).
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Legal Requirements</h4>
                            <p className="text-sm text-muted-foreground">
                                We may disclose information if required by law, to protect our rights, 
                                or to ensure platform safety and security.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">No Sale of Personal Data</h4>
                            <p className="text-sm text-muted-foreground">
                                We do not sell, rent, or trade your personal information to third parties for marketing purposes.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Settings className="h-6 w-6 text-blue-600" />
                            </div>
                            <CardTitle>Your Rights and Choices</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Account Control</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Update your profile information and display name</li>
                                <li>• Control your privacy settings</li>
                                <li>• Delete your account and associated data</li>
                                <li>• Export your data upon request</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Content Management</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Edit or delete your submitted content</li>
                                <li>• Remove your attribution from public displays</li>
                                <li>• Opt out of leaderboard participation</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Communication Preferences</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Opt out of promotional emails</li>
                                <li>• Control notification settings</li>
                                <li>• Manage email frequency preferences</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Data Security</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            We implement appropriate security measures to protect your personal information 
                            against unauthorized access, alteration, disclosure, or destruction. However, 
                            no method of transmission over the internet is 100% secure.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Data Retention</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            We retain your information for as long as your account is active or as needed 
                            to provide services. You may request deletion of your data at any time, 
                            and we will process your request within 30 days.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Children&apos;s Privacy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Vexilo is not intended for children under 13. We do not knowingly collect 
                            personal information from children under 13. If you believe we have collected 
                            such information, please contact us immediately.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Changes to This Policy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            We may update this privacy policy from time to time. We will notify you of 
                            significant changes via email or through the platform. Your continued use of 
                            the service after changes constitutes acceptance of the updated policy.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Contact Us</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            If you have questions about this privacy policy or our data practices, 
                            please contact us at <a href="mailto:privacy@vexilo.com" className="text-blue-600 hover:underline">privacy@vexilo.com</a>.
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