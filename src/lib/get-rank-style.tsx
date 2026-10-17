import { Trophy, Medal, Star, Award, Zap } from '@/components/icons';

export const getRankStyle = (index: number ) => {
  switch (index) {
    case 0: // 1st place
      return {
        card: "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 dark:from-yellow-400/10 dark:to-amber-400/10 dark:border-yellow-400/30",
        badge: "bg-gradient-to-b from-yellow-400 to-amber-500 text-white shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-yellow-300",
        icon: <Trophy className="h-3 w-3" />,
                    rank: "1st",
        rankColor: "text-yellow-600 dark:text-yellow-400",
      };
    case 1: // 2nd place
      return {
        card: "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 dark:from-slate-300/10 dark:to-gray-300/10 dark:border-slate-400/30",
        badge: "bg-gradient-to-b from-gray-300 to-slate-500 text-white shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-gray-300",
        icon: <Medal className="h-3 w-3" />,
                    rank: "2nd",
        rankColor: "text-gray-600 dark:text-slate-400",
      };
    case 2: // 3rd place
      return {
        card: "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 dark:from-orange-400/10 dark:to-amber-400/10 dark:border-orange-400/30",
        badge: "bg-gradient-to-b from-orange-400 to-amber-600 text-white shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-orange-300",
        icon: <Award className="h-3 w-3" />,
                    rank: "3rd",
        rankColor: "text-orange-600 dark:text-orange-400",
      };
    case 3: // 4th place
      return {
        card: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-400/20 dark:to-indigo-400/15 dark:border-blue-400/60",
        badge: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
        icon: <Star className="h-4 w-4" />,
                    rank: "4th",
        rankColor: "text-blue-600 dark:text-blue-300",
      };
    case 4: // 5th place
      return {
        card: "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-400/20 dark:to-violet-400/15 dark:border-purple-400/60",
        badge: "bg-gradient-to-r from-purple-500 to-violet-500 text-white",
        icon: <Zap className="h-4 w-4" />,
                    rank: "5th",
        rankColor: "text-purple-600 dark:text-purple-300",
      };
    default:
      return {
        card: "bg-secondary-background border-border",
        badge: "bg-gray-500 text-white",
        icon: <Star className="h-4 w-4" />,
                    rank: `${index + 1}th`,
        rankColor: "text-foreground/60",
      };
  }
};