import { cn } from "@bhb-login/ui/lib/utils";
import {
	type ComponentProps,
	type CSSProperties,
	createContext,
	type ReactNode,
	useContext,
	useId,
} from "react";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	type DefaultTooltipContentProps,
	Line,
	ResponsiveContainer,
	Tooltip,
	type TooltipValueType,
	XAxis,
	YAxis,
} from "recharts";

const THEMES = { dark: ".dark", light: "" } as const;
const INITIAL_DIMENSION = { height: 240, width: 640 } as const;

type TooltipNameType = number | string;

export type ChartConfig = Record<
	string,
	{
		label?: ReactNode;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<keyof typeof THEMES, string> }
	)
>;

const ChartContext = createContext<ChartConfig | null>(null);

const useChart = () => {
	const config = useContext(ChartContext);
	if (!config) {
		throw new Error("useChart must be used within ChartContainer");
	}
	return config;
};

function ChartContainer({
	children,
	className,
	config,
	id,
	...props
}: ComponentProps<"div"> & {
	children: ComponentProps<typeof ResponsiveContainer>["children"];
	config: ChartConfig;
}) {
	const uniqueId = useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

	return (
		<ChartContext.Provider value={config}>
			<div
				className={cn(
					"flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden",
					className
				)}
				data-chart={chartId}
				data-slot="chart"
				{...props}
			>
				<ChartStyle config={config} id={chartId} />
				<ResponsiveContainer initialDimension={INITIAL_DIMENSION}>
					{children}
				</ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
}

function ChartStyle({ config, id }: { config: ChartConfig; id: string }) {
	const colorConfig = Object.entries(config).filter(
		([, item]) => item.color ?? item.theme
	);
	if (colorConfig.length === 0) {
		return null;
	}

	const css = Object.entries(THEMES)
		.map(([theme, prefix]) => {
			const variables = colorConfig
				.map(([key, item]) => {
					const color =
						item.theme?.[theme as keyof typeof item.theme] ?? item.color;
					return color ? `  --color-${key}: ${color};` : "";
				})
				.filter(Boolean)
				.join("\n");
			return `${prefix} [data-chart=${id}] {\n${variables}\n}`;
		})
		.join("\n");

	return <style>{css}</style>;
}

const ChartTooltip = Tooltip;
const ChartBar = Bar;
const ChartCartesianGrid = CartesianGrid;
const ChartComposed = ComposedChart;
const ChartLine = Line;
const ChartXAxis = XAxis;
const ChartYAxis = YAxis;

function ChartTooltipContent({
	active,
	className,
	label,
	labelFormatter,
	payload,
}: ComponentProps<typeof Tooltip> &
	ComponentProps<"div"> &
	Omit<
		DefaultTooltipContentProps<TooltipValueType, TooltipNameType>,
		"accessibilityLayer"
	>) {
	const config = useChart();
	if (!(active && payload?.length)) {
		return null;
	}

	return (
		<div
			className={cn(
				"grid min-w-40 gap-2 border border-border/70 bg-background px-3 py-2 text-xs shadow-lg",
				className
			)}
		>
			<p className="font-medium">
				{labelFormatter ? labelFormatter(label, payload) : label}
			</p>
			<div className="grid gap-1.5">
				{payload.map((item) => {
					const key = `${item.dataKey ?? item.name ?? "value"}`;
					return (
						<div className="flex items-center justify-between gap-6" key={key}>
							<span className="flex items-center gap-2 text-muted-foreground">
								<span
									aria-hidden="true"
									className="size-2 bg-(--indicator-color)"
									style={
										{
											"--indicator-color": item.color,
										} as CSSProperties
									}
								/>
								{config[key]?.label ?? item.name}
							</span>
							<strong className="font-mono tabular-nums">
								{typeof item.value === "number"
									? item.value.toLocaleString()
									: String(item.value ?? "-")}
							</strong>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export {
	ChartBar,
	ChartCartesianGrid,
	ChartComposed,
	ChartContainer,
	ChartLine,
	ChartTooltip,
	ChartTooltipContent,
	ChartXAxis,
	ChartYAxis,
};
