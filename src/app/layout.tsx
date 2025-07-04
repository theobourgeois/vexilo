import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import Logo from "@/components/Logo";
import { AuthHeader } from "@/components/auth-header";
import { Toaster } from "@/components/ui/sonner";
import { PostFlagButton } from "@/components/post-flag-button";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";

const nunito = Nunito({
    variable: "--font-nunito",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
    title: "Vexilo - Discover Flags from Around the World",
    description: "Explore flags from around the world with Vexilo",
    icons: {
        icon: "/logo.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${nunito.variable} antialiased`}>
                <Toaster />
                <Providers>
                    {/* Logo Header */}
                    <header className="max-w-7xl mx-auto px-4 flex flex-col items-start justify-start py-4">
                        <div className="w-full flex justify-between items-start">
                            <div>
                                <Logo />
                                <p className="text-center text-foreground/60 mt-2 text-sm hidden md:block">
                                    Discover flags from around the world
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="hidden md:flex items-center gap-4">
                                    <ThemeToggle />
                                    <PostFlagButton />
                                    <AuthHeader />
                                </div>
                                <HamburgerMenu />
                            </div>
                        </div>
                    </header>
                    <div className="w-full bg-main/10 min-h-screen">
                        {children}
                    </div>
                    <Footer />
                </Providers>
            </body>
        </html>
    );
}
