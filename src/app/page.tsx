import { Suspense } from "react";
import Image from "next/image";
import allFlags from "../store/all.json";
import FlagSearch from "../components/FlagSearch";
import FlagCard from "../components/FlagCard";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";

type Flag = {
    flagName: string;
    flagImage: string;
    link: string;
    index: number;
};

const flags: Flag[] = allFlags;

// Get flag of the day based on current date
function getFlagOfTheDay(): Flag {
    const today = new Date();
    const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
            (1000 * 60 * 60 * 24)
    );
    const flagIndex = dayOfYear % flags.length;
    return flags[flagIndex];
}

export default function Home() {
    const flagOfTheDay = getFlagOfTheDay();

    return (
        <div className="min-h-screen bg-main/10">
            {/* Logo Header */}
            <div className="max-w-7xl mx-auto px-4 flex flex-col items-start justify-start py-4">
                <div className="flex gap-2 items-center justify-center ">
                    <Image
                        src="/logo.svg"
                        alt="Vexilo Logo"
                        width={48}
                        height={36}
                        className="object-contain"
                    />
                    <h1
                        className="text-3xl text-black font-extrabold"
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
                </div>
                <p className="text-center text-gray-600 mt-2 text-sm">
                    Discover flags from around the world
                </p>
            </div>

            {/* Flag of the Day Section */}
            <Card className="max-w-xs mx-auto px-4 mb-8">
                <CardHeader className="text-2xl font-bold text-gray-800 mb-4 text-center">
                    Flag of the Day
                </CardHeader>
                <CardContent>
                    <FlagCard
                        flagName={flagOfTheDay.flagName}
                        flagImage={flagOfTheDay.flagImage}
                        link={flagOfTheDay.link}
                    />
                </CardContent>
                <CardFooter>
                    <p className="text-center text-gray-600 mt-4 text-sm">
                        Come back tomorrow for a new flag!
                    </p>
                </CardFooter>
            </Card>

            {/* Search and Results */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <Suspense
                    fallback={
                        <div className="space-y-6">
                            <div className="animate-pulse">
                                <div className="h-20 bg-gray-200 rounded-lg mb-6"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="h-48 bg-gray-200 rounded-lg"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    }
                >
                    <FlagSearch flags={flags} />
                </Suspense>
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-gray-500">
                <p>Explore {allFlags.length} flags from around the world</p>
            </div>
        </div>
    );
}
