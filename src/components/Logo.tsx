"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
            <Image
                src="/logo.svg"
                alt="Vexilo Logo"
                width={48}
                height={36}
                className="object-contain"
            />
            <h1
                className={cn(
                    "text-3xl text-black font-extrabold hidden md:block",
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
