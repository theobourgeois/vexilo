import { Trophy, Medal, Star, Award, Zap, ArrowLeft } from "lucide-react";

export const getRankStyle = (index: number ) => {
  switch (index) {
    case 0: // 1st place
      return {
        card: "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 dark:from-yellow-950 dark:to-amber-950 dark:border-yellow-800",
        badge: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white",
        icon: <Trophy className="h-4 w-4" />,
                    rank: "1st",
        rankColor: "text-yellow-600 dark:text-yellow-400",
      };
    case 1: // 2nd place
      return {
        card: "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 dark:from-gray-900 dark:to-slate-900 dark:border-gray-700",
        badge: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
        icon: <Medal className="h-4 w-4" />,
                    rank: "2nd",
        rankColor: "text-gray-600 dark:text-gray-400",
      };
    case 2: // 3rd place
      return {
        card: "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 dark:from-orange-950 dark:to-amber-950 dark:border-orange-800",
        badge: "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
        icon: <Award className="h-4 w-4" />,
                    rank: "3rd",
        rankColor: "text-orange-600 dark:text-orange-400",
      };
    case 3: // 4th place
      return {
        card: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800",
        badge: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
        icon: <Star className="h-4 w-4" />,
                    rank: "4th",
        rankColor: "text-blue-600 dark:text-blue-400",
      };
    case 4: // 5th place
      return {
        card: "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-950 dark:to-violet-950 dark:border-purple-800",
        badge: "bg-gradient-to-r from-purple-500 to-violet-500 text-white",
        icon: <Zap className="h-4 w-4" />,
                    rank: "5th",
        rankColor: "text-purple-600 dark:text-purple-400",
      };
    default:
      return {
        card: "bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700",
        badge: "bg-gray-500 text-white",
        icon: <Star className="h-4 w-4" />,
                    rank: `${index + 1}th`,
        rankColor: "text-gray-600 dark:text-gray-400",
      };
  }
};