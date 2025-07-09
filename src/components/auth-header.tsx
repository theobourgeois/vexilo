"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { FcGoogle } from "react-icons/fc";
import { LogOut, Loader2, Shield, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { getUserData } from "@/actions/users";
import { useQuery } from "@tanstack/react-query";

export function AuthHeader() {
    const { data: session, status } = useSession();
    const { data: userData, isLoading: userDataLoading } = useQuery({
        queryKey: ["userData"],
        queryFn: getUserData,
    });
    const router = useRouter();

    const handleSignIn = async () => {
        void signIn("google").then(() => {
            router.push("/");
        });
    };

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/" });
    };

    if (status === "loading" || userDataLoading) {
        return (
            <div className="flex items-center gap-2 h-full">
                <Loader2 className="h-8 w-8 animate-spin text-main" />
            </div>
        );
    }

    if (!session) {
        return (
            <Button
                className="inline-flex gap-1 bg-white"
                onClick={handleSignIn}
                variant="default"
            >
                Sign in with Google <FcGoogle size="20" />
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 cursor-pointer">
                        <AvatarImage
                            src={session.user?.image || ""}
                            alt={session.user?.name || ""}
                        />
                        <AvatarFallback>
                            {session.user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white">
                <div className="px-2 py-1.5 text-sm font-medium text-gray-900 border-b border-gray-200">
                    {userData?.user?.name || session.user?.name || "User"}
                </div>
                <DropdownMenuItem
                    onClick={() => router.push(`/profile/${userData?.user?.userNumber || "me"}`)}
                    className="bg-white"
                >
                    <User className="h-4 w-4" />
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="bg-white"
                >
                    <Settings className="h-4 w-4" />
                    Settings
                </DropdownMenuItem>
                {session.user?.isAdmin && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => router.push("/admin")}
                            className="bg-white"
                        >
                            <Shield className="h-4 w-4" />
                            Admin
                        </DropdownMenuItem>
                    </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-600 focus:text-red-700 focus:bg-red-50 bg-white"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
