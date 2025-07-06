import Link from "next/link";
import { Heart, Shield, FileText, Coffee } from "lucide-react";
import { Button } from "./ui/button";

export function Footer() {
    return (
        <footer className="border-t border-main bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
 {/* Footer */}
            <div className="text-center py-4 text-foreground/60">
                <div className="mt-4">
                    <Button
                        asChild
                        variant="default"
                    >
                        <a
                            href="https://buymeacoffee.com/theobourgeois"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Coffee className="w-4 h-4" />
                            Buy me a coffee
                        </a>
                    </Button>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid gap-8 md:grid-cols-4">
                    {/* Brand Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Vexilo</h3>
                        <p className="text-sm text-muted-foreground">
                            Discover flags from around the world with our community of flag enthusiasts.
                        </p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span>Made with</span>
                            <Heart className="h-4 w-4 text-red-500" />
                            <span>for flag lovers</span>
                        </div>
                    </div>

                    {/* Community Section */}
                    <div className="space-y-3">
                        <h4 className="font-medium">Community</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link 
                                    href="/community-guidelines" 
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Community Guidelines
                                </Link>
                            </li>
                            <li>
                                <Link 
                                    href="/post-flag" 
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Submit a Flag
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal Section */}
                    <div className="space-y-3">
                        <h4 className="font-medium">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link 
                                    href="/terms-of-service" 
                                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <FileText className="h-3 w-3" />
                                    Terms of Service
                                </Link>
                            </li>
                            <li>
                                <Link 
                                    href="/privacy-policy" 
                                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <Shield className="h-3 w-3" />
                                    Privacy Policy
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Support Section */}
                    <div className="space-y-3">
                        <h4 className="font-medium">Support</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a 
                                    href="mailto:theoobourgeois@gmail.com" 
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Contact Support
                                </a>
                            </li>
                            
                            
                        </ul>
                    </div>
                </div>

                <div className="border-t mt-8 pt-6 border-main/20">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} Vexilo. All rights reserved.
                        </p>
                       
                    </div>
                </div>
            </div>
        </footer>
    );
} 