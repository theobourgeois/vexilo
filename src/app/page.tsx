import { Suspense } from "react";
import allFlags from "../store/all.json";
import FlagSearch from "../components/FlagSearch";

type Flag = {
    flagName: string;
    flagImage: string;
    link: string;
    index: number;
};

const flags: Flag[] = allFlags;

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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
