import { Badge } from "@bhb-login/ui/components/badge";
import { Button } from "@bhb-login/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@bhb-login/ui/components/card";
import {
	ChartBar,
	ChartCartesianGrid,
	ChartComposed,
	type ChartConfig,
	ChartContainer,
	ChartLine,
	ChartTooltip,
	ChartTooltipContent,
	ChartXAxis,
	ChartYAxis,
} from "@bhb-login/ui/components/chart";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@bhb-login/ui/components/empty";
import { Progress } from "@bhb-login/ui/components/progress";
import { Skeleton } from "@bhb-login/ui/components/skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ActivityIcon,
	ArrowLeftIcon,
	CheckCircle2Icon,
	CircleGaugeIcon,
	Clock3Icon,
	RefreshCwIcon,
	ServerCogIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import LanguageToggle from "@/components/language-toggle";
import { type AppTranslations, type Locale, useLanguage } from "@/i18n";

export const Route = createFileRoute("/_auth/performance")({
	component: RouteComponent,
});

interface PerformanceSummary {
	apiHealth: {
		errors: number;
		requests: number;
		successRate: number | null;
	};
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
	slowApis: Array<{
		apiName: string;
		averageDurationMs: number;
		calls: number;
		errors: number;
	}>;
	topRoutes: Array<{ count: number; route: string }>;
	totalEvents: number;
	trend: Array<{
		averageDurationMs: number | null;
		date: string;
		events: number;
	}>;
}

interface TrendPoint {
	averageDurationMs: number | null;
	date: string;
	events: number;
}

type VitalRating = "good" | "needsImprovement" | "noSamples" | "poor";

const serverUrl = import.meta.env.VITE_SERVER_URL;
const chartConfig = {
	averageDurationMs: {
		color: "var(--chart-3)",
		label: "Average duration",
	},
	events: {
		color: "var(--chart-1)",
		label: "Events",
	},
} satisfies ChartConfig;

const vitalThresholds = {
	cls: { good: 0.1, poor: 0.25 },
	fcp: { good: 1800, poor: 3000 },
	inp: { good: 200, poor: 500 },
	lcp: { good: 2500, poor: 4000 },
} as const;

const formatMetric = (
	value: number | null,
	suffix = " ms",
	maximumFractionDigits = 0
) =>
	value === null
		? "-"
		: `${value.toLocaleString(undefined, { maximumFractionDigits })}${suffix}`;

const formatDateTime = (value: string, locale: Locale) =>
	new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "short",
	}).format(new Date(value));

const buildTrend = (
	summary: PerformanceSummary,
	locale: Locale
): TrendPoint[] => {
	const valuesByDate = new Map(
		summary.trend.map((item) => [item.date.slice(0, 10), item])
	);
	const endDate = new Date(summary.generatedAt);
	endDate.setUTCHours(0, 0, 0, 0);
	const dateFormatter = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

	return Array.from({ length: summary.days }, (_, index) => {
		const date = new Date(endDate);
		date.setUTCDate(endDate.getUTCDate() - (summary.days - index - 1));
		const dateKey = date.toISOString().slice(0, 10);
		const value = valuesByDate.get(dateKey);
		return {
			averageDurationMs: value?.averageDurationMs ?? null,
			date: dateFormatter.format(date),
			events: value?.events ?? 0,
		};
	});
};

function RouteComponent() {
	const { locale, t } = useLanguage();
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
				{ credentials: "include" }
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

	const trend = useMemo(
		() => (summary ? buildTrend(summary, locale) : []),
		[locale, summary]
	);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-border/80 border-b bg-card">
				<div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
					<div className="flex min-w-0 items-center gap-3">
						<Link aria-label={t.introduction.back} to="/dashboard">
							<Button size="icon" variant="outline">
								<ArrowLeftIcon aria-hidden="true" />
							</Button>
						</Link>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="font-semibold text-2xl sm:text-3xl">
									{t.performance.title}
								</h1>
								<Badge variant="secondary">
									<CheckCircle2Icon
										aria-hidden="true"
										data-icon="inline-start"
									/>
									{t.performance.statusHealthy}
								</Badge>
							</div>
							<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
								{t.performance.subtitle}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<LanguageToggle />
						<Button disabled={loading} onClick={loadSummary} variant="outline">
							<RefreshCwIcon
								aria-hidden="true"
								className={loading ? "animate-spin" : undefined}
								data-icon="inline-start"
							/>
							<span className="hidden sm:inline">{t.performance.refresh}</span>
						</Button>
					</div>
				</div>
			</header>

			<main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<fieldset className="inline-flex border border-border bg-card p-1">
						<legend className="sr-only">{t.performance.rangeLabel}</legend>
						<RangeButton
							active={days === 7}
							label={t.performance.last7Days}
							onClick={() => setDays(7)}
						/>
						<RangeButton
							active={days === 30}
							label={t.performance.last30Days}
							onClick={() => setDays(30)}
						/>
					</fieldset>
					{summary ? (
						<p className="text-muted-foreground text-xs tabular-nums">
							{t.performance.generatedAt}:{" "}
							{formatDateTime(summary.generatedAt, locale)}
						</p>
					) : null}
				</div>

				{loading ? <DashboardSkeleton /> : null}
				{!loading && error ? (
					<StatePanel
						actionLabel={t.common.retry}
						description={t.performance.loadFailed}
						onRetry={loadSummary}
						title={t.performance.loadFailed}
					/>
				) : null}
				{!(loading || error) && summary?.totalEvents === 0 ? (
					<StatePanel
						actionLabel={t.common.retry}
						description={t.performance.subtitle}
						onRetry={loadSummary}
						title={t.performance.noData}
					/>
				) : null}
				{!(loading || error) && summary && summary.totalEvents > 0 ? (
					<PerformanceDashboard
						locale={locale}
						summary={summary}
						t={t}
						trend={trend}
					/>
				) : null}
			</main>
		</div>
	);
}

function RangeButton({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<Button
			aria-pressed={active}
			onClick={onClick}
			size="sm"
			type="button"
			variant={active ? "default" : "ghost"}
		>
			{label}
		</Button>
	);
}

function PerformanceDashboard({
	locale,
	summary,
	t,
	trend,
}: {
	locale: Locale;
	summary: PerformanceSummary;
	t: AppTranslations;
	trend: TrendPoint[];
}) {
	const maxRouteCount = Math.max(
		...summary.topRoutes.map((item) => item.count),
		1
	);
	const maxEventCount = Math.max(
		...summary.byEventType.map((item) => item.count),
		1
	);

	return (
		<>
			<section className="grid border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
				<OverviewMetric
					icon={ActivityIcon}
					label={t.performance.totalEvents}
					value={summary.totalEvents.toLocaleString(locale)}
				/>
				<OverviewMetric
					icon={Clock3Icon}
					label={t.performance.averageDuration}
					value={formatMetric(summary.averages.durationMs)}
				/>
				<OverviewMetric
					icon={CircleGaugeIcon}
					label={t.performance.apiSuccessRate}
					value={formatMetric(summary.apiHealth.successRate, "%", 1)}
				/>
				<OverviewMetric
					icon={TriangleAlertIcon}
					label={t.performance.apiErrors}
					value={summary.apiHealth.errors.toLocaleString(locale)}
				/>
			</section>

			<section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
				<Card>
					<CardHeader className="border-b">
						<CardTitle>{t.performance.requestTrend}</CardTitle>
						<CardDescription>
							{t.performance.requestTrendDescription}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ChartContainer
							className="h-[300px] w-full"
							config={{
								...chartConfig,
								averageDurationMs: {
									...chartConfig.averageDurationMs,
									label: t.performance.averageDuration,
								},
								events: {
									...chartConfig.events,
									label: t.performance.events,
								},
							}}
						>
							<ChartComposed data={trend} margin={{ left: -18, right: 8 }}>
								<ChartCartesianGrid vertical={false} />
								<ChartXAxis
									axisLine={false}
									dataKey="date"
									minTickGap={24}
									tickLine={false}
								/>
								<ChartYAxis
									allowDecimals={false}
									axisLine={false}
									tickLine={false}
								/>
								<ChartYAxis hide orientation="right" yAxisId="duration" />
								<ChartTooltip content={<ChartTooltipContent />} />
								<ChartBar
									dataKey="events"
									fill="var(--color-events)"
									maxBarSize={36}
									radius={0}
								/>
								<ChartLine
									connectNulls
									dataKey="averageDurationMs"
									dot={false}
									stroke="var(--color-averageDurationMs)"
									strokeWidth={2}
									type="monotone"
									yAxisId="duration"
								/>
							</ChartComposed>
						</ChartContainer>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="border-b">
						<CardTitle>{t.performance.webVitals}</CardTitle>
						<CardDescription>
							{t.performance.webVitalsDescription}
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-5">
						<VitalRow
							label={t.performance.fcp}
							labels={t.performance}
							thresholds={vitalThresholds.fcp}
							value={summary.averages.fcpMs}
						/>
						<VitalRow
							label={t.performance.lcp}
							labels={t.performance}
							thresholds={vitalThresholds.lcp}
							value={summary.averages.lcpMs}
						/>
						<VitalRow
							label={t.performance.inp}
							labels={t.performance}
							thresholds={vitalThresholds.inp}
							value={summary.averages.inpMs}
						/>
						<VitalRow
							fractionDigits={3}
							label={t.performance.cls}
							labels={t.performance}
							suffix=""
							thresholds={vitalThresholds.cls}
							value={summary.averages.cls}
						/>
					</CardContent>
				</Card>
			</section>

			<section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
				<DistributionCard
					emptyLabel={t.performance.noData}
					items={summary.topRoutes.map((item) => ({
						label: item.route,
						percentage: (item.count / maxRouteCount) * 100,
						value: item.count,
					}))}
					title={t.performance.topRoutes}
				/>
				<SlowApiCard summary={summary} t={t} />
				<DistributionCard
					emptyLabel={t.performance.noData}
					items={summary.byEventType.map((item) => ({
						label: getEventLabel(item.eventType, t.performance),
						percentage: (item.count / maxEventCount) * 100,
						value: item.count,
					}))}
					title={t.performance.eventBreakdown}
				/>
			</section>
		</>
	);
}

function OverviewMetric({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof ActivityIcon;
	label: string;
	value: string;
}) {
	return (
		<div className="flex min-h-32 items-start gap-4 border-border not-last:border-b p-5 sm:nth-3:border-b-0 sm:odd:border-r xl:not-last:border-r xl:not-last:border-b-0">
			<div className="flex size-9 shrink-0 items-center justify-center bg-muted text-primary">
				<Icon aria-hidden="true" className="size-4" />
			</div>
			<div className="min-w-0">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p className="mt-3 font-semibold text-2xl tabular-nums">{value}</p>
			</div>
		</div>
	);
}

function VitalRow({
	fractionDigits = 0,
	label,
	labels,
	suffix = " ms",
	thresholds,
	value,
}: {
	fractionDigits?: number;
	label: string;
	labels: AppTranslations["performance"];
	suffix?: string;
	thresholds: { good: number; poor: number };
	value: number | null;
}) {
	const rating = getVitalRating(value, thresholds);
	const score = getVitalScore(value, thresholds);
	const ratingLabel = labels[rating];

	return (
		<div className="grid gap-2">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="font-medium text-sm">{label}</p>
					<p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
						{value === null
							? labels.noSamples
							: formatMetric(value, suffix, fractionDigits)}
					</p>
				</div>
				<Badge variant={getRatingVariant(rating)}>{ratingLabel}</Badge>
			</div>
			<Progress aria-label={`${label}: ${ratingLabel}`} value={score} />
		</div>
	);
}

function DistributionCard({
	emptyLabel,
	items,
	title,
}: {
	emptyLabel: string;
	items: Array<{ label: string; percentage: number; value: number }>;
	title: string;
}) {
	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				{items.length === 0 ? (
					<p className="text-muted-foreground text-sm">{emptyLabel}</p>
				) : (
					items.slice(0, 6).map((item) => (
						<div className="grid gap-2" key={item.label}>
							<div className="flex items-center justify-between gap-4 text-sm">
								<span className="truncate" title={item.label}>
									{item.label}
								</span>
								<strong className="tabular-nums">
									{item.value.toLocaleString()}
								</strong>
							</div>
							<Progress aria-label={item.label} value={item.percentage} />
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function SlowApiCard({
	summary,
	t,
}: {
	summary: PerformanceSummary;
	t: AppTranslations;
}) {
	return (
		<Card>
			<CardHeader className="border-b">
				<CardTitle>{t.performance.slowApis}</CardTitle>
				<CardDescription>{t.performance.slowApisDescription}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				{summary.slowApis.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t.performance.noData}
					</p>
				) : (
					summary.slowApis.slice(0, 6).map((item, index) => (
						<div
							className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-border/70 border-b pb-3 last:border-b-0 last:pb-0"
							key={item.apiName}
						>
							<Badge variant="outline">{index + 1}</Badge>
							<div className="min-w-0">
								<p
									className="truncate font-medium text-sm"
									title={item.apiName}
								>
									{item.apiName}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
									{item.calls} {t.performance.apiCalls}
									{item.errors > 0
										? ` · ${item.errors} ${t.performance.apiErrors}`
										: ""}
								</p>
							</div>
							<strong className="font-mono text-sm tabular-nums">
								{formatMetric(item.averageDurationMs)}
							</strong>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function DashboardSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
				{["events", "latency", "success", "errors"].map((item) => (
					<div className="grid min-h-32 gap-4 border-border p-5" key={item}>
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-8 w-32" />
					</div>
				))}
			</div>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
				<Skeleton className="h-[390px] w-full" />
				<Skeleton className="h-[390px] w-full" />
			</div>
		</div>
	);
}

function StatePanel({
	actionLabel,
	description,
	onRetry,
	title,
}: {
	actionLabel: string;
	description: string;
	onRetry: () => void;
	title: string;
}) {
	return (
		<Empty className="min-h-80 border border-border bg-card">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ServerCogIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button onClick={onRetry} variant="outline">
					<RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
					{actionLabel}
				</Button>
			</EmptyContent>
		</Empty>
	);
}

const getVitalRating = (
	value: number | null,
	thresholds: { good: number; poor: number }
): VitalRating => {
	if (value === null) {
		return "noSamples";
	}
	if (value <= thresholds.good) {
		return "good";
	}
	if (value <= thresholds.poor) {
		return "needsImprovement";
	}
	return "poor";
};

const getVitalScore = (
	value: number | null,
	thresholds: { good: number; poor: number }
) => {
	if (value === null) {
		return 0;
	}
	if (value <= thresholds.good) {
		return 100 - (value / thresholds.good) * 20;
	}
	if (value <= thresholds.poor) {
		return (
			80 -
			((value - thresholds.good) / (thresholds.poor - thresholds.good)) * 40
		);
	}
	return Math.max(5, 40 - ((value - thresholds.poor) / thresholds.poor) * 35);
};

const getRatingVariant = (rating: VitalRating) => {
	if (rating === "good") {
		return "default" as const;
	}
	if (rating === "poor") {
		return "destructive" as const;
	}
	if (rating === "needsImprovement") {
		return "secondary" as const;
	}
	return "outline" as const;
};

const getEventLabel = (
	eventType: string,
	labels: AppTranslations["performance"]
) => {
	const eventLabels: Record<string, string> = {
		api_request: labels.eventApiRequest,
		client_error: labels.eventClientError,
		page_view: labels.eventPageView,
		web_vital: labels.eventWebVital,
	};
	return eventLabels[eventType] ?? eventType;
};
