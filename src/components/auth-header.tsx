"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { FcGoogle } from "react-icons/fc";
import { LogOut, Loader2, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AuthHeader() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const handleSignIn = async () => {
        void signIn("google").then(() => {
            router.push("/");
        });
    };

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/" });
    };

    if (status === "loading") {
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
                {session.user?.isAdmin && (
                    <>
                        <DropdownMenuItem
                            onClick={() => router.push("/admin")}
                            className="bg-white"
                        >
                            <Shield className="h-4 w-4" />
                            Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
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
