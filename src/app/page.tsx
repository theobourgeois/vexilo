import { Suspense } from "react";
import FlagSearch from "../components/FlagSearch";
import FlagQuiz from "../components/FlagQuiz";
import { FlagOfTheDay } from "@/components/flag-of-the-day";
import { Leaderboard } from "@/components/leaderboard";

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

            <div className="max-w-7xl mx-auto px-4 mb-8">
                <Leaderboard />
            </div>

            {/* Search and Results */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <Suspense
                    fallback={
                        <div className="space-y-6">
                            <div className="animate-pulse">
                                <div className="h-20 bg-secondary-background rounded-lg mb-6"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="animate-pulse">
                                        <div className="h-48 bg-secondary-background rounded-lg"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    }
                >
                    <FlagSearch />
                </Suspense>
            </div>

           
        </div>
    );
}
