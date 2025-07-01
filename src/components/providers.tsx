"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <ThemeProvider>
                    {children}
                </ThemeProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
}
