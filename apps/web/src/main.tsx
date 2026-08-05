import { createPerformanceClient } from "@bhb-login/performance-sdk";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";
import { queryClient, trpc } from "./utils/trpc";

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultPendingComponent: () => <Loader />,
	context: { trpc, queryClient },
	Wrap({ children }: { children: React.ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	},
});

const performanceClient = createPerformanceClient({
	endpoint: `${import.meta.env.VITE_SERVER_URL}/api/telemetry/events`,
	release: import.meta.env.VITE_RELEASE,
	sampleRate: Number(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE ?? "0.1"),
});
performanceClient.start();

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("未找到根节点");
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
