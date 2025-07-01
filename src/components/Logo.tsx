"use client";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { SvgLogo } from "./svg-logo";

export default function Logo({ showText = false }: { showText?: boolean }) {
    const router = useRouter();

    const handleLogoClick = () => {
        // Clear URL parameters and navigate to home
        router.replace("/");
    };

    return (
        <button
            onClick={handleLogoClick}
            className="flex gap-2 cursor-pointer items-center justify-center hover:opacity-80 transition-opacity"
        >
            <SvgLogo className="w-12 h-12" />
            <h1
                className={cn(
                    "text-3xl font-extrabold hidden md:block",
                    showText && "block"
                )}
                style={{
                    fontFamily: "Times New Roman",
                    fontWeight: "bold",
                    fontStyle: "italic",
                    fontSize: "3rem",
                    lineHeight: "1.2",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    textAlign: "center",
                }}
            >
                VEXILO
            </h1>
        </button>
    );
}
