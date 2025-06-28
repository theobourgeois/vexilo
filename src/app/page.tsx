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
                <FlagSearch flags={flags} />
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-gray-500">
                <p>Explore {allFlags.length} flags from around the world</p>
            </div>
        </div>
    );
}
