import { env } from "@bhb-login/env/web";
import { Button } from "@bhb-login/ui/components/button";
import { Card, CardContent, CardHeader } from "@bhb-login/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import LanguageToggle from "@/components/language-toggle";
import { useLanguage } from "@/i18n";

export const Route = createFileRoute("/sam-demo")({
	component: RouteComponent,
});

interface HelloApiResponse {
	message: string;
	runtime: string;
	service: string;
	timestamp: string;
}

function RouteComponent() {
	const { t } = useLanguage();
	const [data, setData] = useState<HelloApiResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const apiUrl = useMemo(() => `${env.VITE_SERVER_URL}/api/hello`, []);

	const loadHello = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText}`);
			}

			const payload = (await response.json()) as HelloApiResponse;
			setData(payload);
		} catch (requestError) {
			const message =
				requestError instanceof Error ? requestError.message : t.samDemo.error;
			setError(message);
		} finally {
			setIsLoading(false);
		}
	}, [apiUrl, t.samDemo.error]);

	useEffect(() => {
		loadHello();
	}, [loadHello]);

	return (
		<main className="min-h-screen bg-background px-6 py-8 text-foreground">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-col gap-2">
						<h1 className="font-semibold text-3xl text-foreground">
							{t.samDemo.title}
						</h1>
						<p className="max-w-2xl text-muted-foreground text-sm leading-6">
							{t.samDemo.subtitle}
						</p>
					</div>
					<LanguageToggle />
				</div>

				<Card className="rounded-lg">
					<CardHeader className="flex-row items-start justify-between gap-4">
						<div className="flex flex-col gap-1">
							<h2 className="font-semibold text-card-foreground text-lg">
								{t.samDemo.apiCardTitle}
							</h2>
							<p className="break-all text-muted-foreground text-xs">
								{t.samDemo.apiLabel}: {apiUrl}
							</p>
						</div>
						<Button
							className="shrink-0 rounded-lg"
							disabled={isLoading}
							onClick={() => {
								loadHello();
							}}
							type="button"
							variant="outline"
						>
							<RefreshCwIcon
								aria-hidden="true"
								className={isLoading ? "size-4 animate-spin" : "size-4"}
							/>
							{isLoading ? t.samDemo.loading : t.samDemo.refresh}
						</Button>
					</CardHeader>
					<CardContent>
						{error ? (
							<p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
								{t.samDemo.error}: {error}
							</p>
						) : (
							<pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
								{JSON.stringify(data, null, 2)}
							</pre>
						)}
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
