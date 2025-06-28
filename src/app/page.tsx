import { Suspense } from "react";
import { Flag } from "lucide-react";
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
            {/* Logo Header */}
            <div className="max-w-7xl mx-auto px-4 pt-8 pb-6">
                <div className="flex items-center justify-center space-x-0">
                    <div className="relative">
                        <Flag
                            strokeWidth={3}
                            className="w-8 h-6 text-black font-bold scale-x-[-1]"
                        />
                    </div>
                    <h1 className="text-3xl text-black font-extrabold">
                        vexilo
                    </h1>

                    <div className="relative">
                        <Flag
                            strokeWidth={3}
                            className="w-8 h-6 text-black font-bold "
                        />
                    </div>
                </div>
                <p className="text-center text-gray-600 mt-2 text-sm">
                    Discover flags from around the world
                </p>
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
