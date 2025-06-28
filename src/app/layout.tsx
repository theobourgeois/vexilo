import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

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
            <body className={`${nunito.variable} antialiased`}>{children}</body>
        </html>
    );
}
