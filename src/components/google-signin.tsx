"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { FcGoogle } from "react-icons/fc";

export function GoogleSignin() {
    const router = useRouter();

    const handleSignIn = async () => {
        void signIn("google").then(() => {
            router.push("/");
        });
    };

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
