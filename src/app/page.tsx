import { Suspense } from "react";
import allFlags from "../store/all.json";
import FlagSearch from "../components/FlagSearch";
import FlagQuiz from "../components/FlagQuiz";
import { Button } from "@/components/ui/button";
import { Coffee } from "lucide-react";
import { FlagOfTheDay } from "@/components/flag-of-the-day";

export default function Home() {
    return (
        <div className="min-h-screen bg-main/10 pt-4">
            {/* Flag Quiz and Flag of the Day Section */}
            <div className="max-w-7xl mx-auto px-4 mb-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Flag Quiz Section */}
                    <div className="flex-3 lg:flex-[3]">
                        <FlagQuiz />
                    </div>

                    {/* Flag of the Day Section */}
                    <div className="flex-1 lg:flex-[1]">
                        <FlagOfTheDay />
                    </div>
                </div>
            </div>

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
                    <FlagSearch />
                </Suspense>
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-gray-500">
                <p>Explore {allFlags.length} flags from around the world</p>
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
        </div>
    );
}
