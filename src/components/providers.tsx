"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Reduce unnecessary refetches
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
			retry: 1,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
		},
		mutations: {
			retry: 1,
		},
	},
});

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			<SessionProvider>
				<ThemeProvider>{children}</ThemeProvider>
			</SessionProvider>
		</QueryClientProvider>
	);
}
