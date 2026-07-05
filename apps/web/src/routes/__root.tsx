import { Toaster } from "@bhb-login/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";

import { LanguageProvider } from "@/i18n";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: typeof trpc;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "BHB 登录",
			},
			{
				name: "description",
				content: "BHB 登录系统",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	return (
		<LanguageProvider>
			<HeadContent />
			<Outlet />
			<Toaster richColors />
		</LanguageProvider>
	);
}
