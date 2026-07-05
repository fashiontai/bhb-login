import type { AppRouter } from "@bhb-login/api/routers/index";
import { env } from "@bhb-login/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { getRuntimeTranslations } from "@/i18n";

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			const t = getRuntimeTranslations();
			toast.error(error.message, {
				action: {
					label: t.common.retry,
					onClick: () => {
						query.invalidate();
					},
				},
			});
		},
	}),
});

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${env.VITE_SERVER_URL}/trpc`,
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include",
				});
			},
		}),
	],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
});
