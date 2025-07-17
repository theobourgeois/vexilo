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
import { Analytics } from "@vercel/analytics/next"


const nunito = Nunito({
    variable: "--font-nunito",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
});

export const keywords = [
    "flags",
    "world flags",
    "country flags",
    "flag database",
    "flag search",
    "flag collection",
    "national flags",
    "Vexilo",
    "discover flags",
    "flag quiz",
    "flag of the day",
    "flag community",
    "flag enthusiasts",
    "learn flags",
    "flag trivia",
    "geography",
    "international flags",
    "flag history",
    "flag meanings",
    "flag symbols",
    "flag identification",
];

export const metadata: Metadata = {
    title: "Vexilo - Discover Flags from Around the World",
    description:
        "Explore, discover, and learn about flags from around the world with Vexilo. Join a community of flag enthusiasts, take quizzes, and contribute to the world's most engaging flag database.",
    keywords,
    authors: [
        { name: "Théo Bourgeois" },
        { name: "Vexilo Community" },
    ],
    generator: "Next.js",
    applicationName: "Vexilo - World Flag Discovery Platform",
    referrer: "origin-when-cross-origin",
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://vexilo.org",
        title: "Vexilo - Discover Flags from Around the World",
        description:
            "Explore, discover, and learn about flags from around the world with Vexilo. Join a community of flag enthusiasts, take quizzes, and contribute to the world's most engaging flag database.",
        siteName: "Vexilo",
        images: [
            {
                url: "/logo.png",
                width: 1200,
                height: 630,
                alt: "Vexilo - Discover Flags from Around the World",
            },
        ],
    },
    icons: {
        icon: "/logo.png",
        shortcut: "/logo.png",
        apple: "/logo.png",
        other: [
            {
                rel: "icon",
                type: "image/png",
                sizes: "512x512",
                url: "/logo.png",
            },
        ],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    // verification: {
    //     google: process.env.GOOGLE_VERIFICATION,
    // },
    alternates: {
        canonical: "https://vexilo.org",
    },
    category: "education",
    manifest: "/manifest.json",
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
                <Analytics />
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
