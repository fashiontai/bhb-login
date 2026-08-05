import { Button } from "@bhb-login/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@bhb-login/ui/components/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ActivityIcon, ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import LanguageToggle from "@/components/language-toggle";
import { useLanguage } from "@/i18n";

export const Route = createFileRoute("/_auth/performance")({
	component: RouteComponent,
});

interface PerformanceSummary {
	averages: {
		cls: number | null;
		durationMs: number | null;
		fcpMs: number | null;
		inpMs: number | null;
		lcpMs: number | null;
	};
	byEventType: Array<{ count: number; eventType: string }>;
	days: number;
	generatedAt: string;
	topRoutes: Array<{ count: number; route: string }>;
	totalEvents: number;
}

const serverUrl = import.meta.env.VITE_SERVER_URL;

const formatMetric = (value: number | null, suffix = " ms") =>
	value === null ? "-" : `${Math.round(value * 100) / 100}${suffix}`;

function RouteComponent() {
	const { t } = useLanguage();
	const [days, setDays] = useState(7);
	const [summary, setSummary] = useState<PerformanceSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	const loadSummary = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const response = await fetch(
				`${serverUrl}/api/performance/summary?days=${days}`,
				{
					credentials: "include",
				}
			);
			if (!response.ok) {
				throw new Error("Performance summary request failed");
			}
			setSummary((await response.json()) as PerformanceSummary);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}, [days]);

	useEffect(() => {
		loadSummary().catch(() => undefined);
	}, [loadSummary]);

	let content: ReactNode;
	if (loading) {
		content = (
			<Card>
				<CardContent className="py-12 text-center text-muted-foreground">
					{t.performance.loading}
				</CardContent>
			</Card>
		);
	} else if (error) {
		content = (
			<Card>
				<CardContent className="py-12 text-center text-destructive">
					{t.performance.loadFailed}
				</CardContent>
			</Card>
		);
	} else if (summary && summary.totalEvents > 0) {
		content = (
			<>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<MetricCard
						label={t.performance.totalEvents}
						value={summary.totalEvents.toLocaleString()}
					/>
					<MetricCard
						label={t.performance.averageDuration}
						value={formatMetric(summary.averages.durationMs)}
					/>
					<MetricCard
						label={t.performance.fcp}
						value={formatMetric(summary.averages.fcpMs)}
					/>
					<MetricCard
						label={t.performance.lcp}
						value={formatMetric(summary.averages.lcpMs)}
					/>
					<MetricCard
						label={t.performance.cls}
						value={formatMetric(summary.averages.cls, "")}
					/>
				</div>
				<div className="grid gap-4 lg:grid-cols-2">
					<BreakdownCard
						emptyLabel={t.performance.noData}
						items={summary.byEventType.map((item) => ({
							label: item.eventType,
							value: item.count,
						}))}
						title={t.performance.eventBreakdown}
					/>
					<BreakdownCard
						emptyLabel={t.performance.noData}
						items={summary.topRoutes.map((item) => ({
							label: item.route,
							value: item.count,
						}))}
						title={t.performance.topRoutes}
					/>
				</div>
			</>
		);
	} else {
		content = (
			<Card>
				<CardContent className="py-12 text-center text-muted-foreground">
					{t.performance.noData}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="min-h-screen bg-background px-6 py-10 text-foreground">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<header className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex items-start gap-3">
						<Link aria-label={t.introduction.back} to="/dashboard">
							<Button size="icon" variant="outline">
								<ArrowLeftIcon aria-hidden="true" />
							</Button>
						</Link>
						<div>
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<ActivityIcon aria-hidden="true" className="size-4" />
								{t.performance.title}
							</div>
							<h1 className="mt-2 font-semibold text-3xl tracking-tight">
								{t.performance.title}
							</h1>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<LanguageToggle />
						<Button onClick={() => loadSummary()} variant="outline">
							<RefreshCwIcon aria-hidden="true" />
							{t.performance.refresh}
						</Button>
					</div>
				</header>

				<div className="flex items-center gap-3">
					<label className="font-medium text-sm" htmlFor="performance-days">
						{t.performance.rangeLabel}
					</label>
					<select
						className="h-8 border border-border bg-background px-2 text-sm"
						id="performance-days"
						onChange={(event) => setDays(Number(event.target.value))}
						value={days}
					>
						<option value={7}>7 days</option>
						<option value={30}>30 days</option>
					</select>
				</div>

				{content}
			</div>
		</div>
	);
}

function MetricCard({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="mt-2 text-2xl">{value}</CardTitle>
			</CardHeader>
		</Card>
	);
}

function BreakdownCard({
	emptyLabel,
	items,
	title,
}: {
	emptyLabel: string;
	items: Array<{ label: string; value: number }>;
	title: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<p className="text-muted-foreground">{emptyLabel}</p>
				) : (
					<div className="flex flex-col gap-3">
						{items.map((item) => (
							<div
								className="flex items-center justify-between gap-4 text-sm"
								key={item.label}
							>
								<span className="truncate">{item.label}</span>
								<strong>{item.value.toLocaleString()}</strong>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
