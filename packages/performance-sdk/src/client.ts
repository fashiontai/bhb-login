import type { PerformanceEvent, PerformanceMetrics } from "./contract.js";

interface PerformanceEntryLike {
	duration: number;
	name: string;
	startTime: number;
}

interface PerformanceObserverLike {
	disconnect: () => void;
	observe: (options: { buffered: boolean; type: string }) => void;
}

interface BrowserGlobals {
	document: {
		addEventListener: (type: string, listener: () => void) => void;
		removeEventListener: (type: string, listener: () => void) => void;
		visibilityState: string;
	};
	navigator: {
		sendBeacon?: (url: string, data?: unknown) => boolean;
	};
	PerformanceObserver?: new (
		callback: (list: { getEntries: () => PerformanceEntryLike[] }) => void
	) => PerformanceObserverLike;
	performance: {
		getEntriesByType: (type: string) => PerformanceEntryLike[];
		now: () => number;
	};
	window: {
		clearInterval: (id: number) => void;
		location: { pathname: string };
		setInterval: (callback: () => void, delay: number) => number;
		sessionStorage: {
			getItem: (key: string) => string | null;
			setItem: (key: string, value: string) => void;
		};
	};
}

const browser = globalThis as unknown as BrowserGlobals;

const SDK_VERSION = "0.0.1";
const DEFAULT_FLUSH_INTERVAL_MS = 10_000;
const DEFAULT_MAX_BATCH_SIZE = 10;

export interface PerformanceClientOptions {
	endpoint: string;
	flushIntervalMs?: number;
	maxBatchSize?: number;
	release?: string;
	sampleRate?: number;
}

export interface PerformanceClient {
	flush: () => Promise<void>;
	recordApiRequest: (
		name: string,
		request: Promise<Response>
	) => Promise<Response>;
	start: () => void;
	stop: () => void;
}

const createAnonymousId = (): string => {
	try {
		const storedId =
			browser.window.sessionStorage.getItem("bhb-performance-id");
		if (storedId) {
			return storedId;
		}

		const id = crypto.randomUUID();
		browser.window.sessionStorage.setItem("bhb-performance-id", id);
		return id;
	} catch {
		return crypto.randomUUID();
	}
};

const getRoute = (): string => browser.window.location.pathname || "/";

const safePositiveNumber = (value: number): number | undefined =>
	Number.isFinite(value) && value >= 0
		? Math.round(value * 100) / 100
		: undefined;

export const createPerformanceClient = (
	options: PerformanceClientOptions
): PerformanceClient => {
	const anonymousId = createAnonymousId();
	const release = options.release;
	const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
	const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
	const sampleRate = Math.min(1, Math.max(0, options.sampleRate ?? 1));
	const enabled = Math.random() <= sampleRate;
	const pendingEvents: PerformanceEvent[] = [];
	const observers: PerformanceObserverLike[] = [];
	let flushTimer: number | undefined;
	let started = false;

	const queueEvent = (
		eventType: PerformanceEvent["eventType"],
		metrics?: PerformanceMetrics
	) => {
		if (!enabled) {
			return;
		}

		pendingEvents.push({
			anonymousId,
			eventType,
			...(metrics ? { metrics } : {}),
			occurredAt: new Date().toISOString(),
			...(release ? { release } : {}),
			route: getRoute(),
			sdkVersion: SDK_VERSION,
		});

		if (pendingEvents.length >= maxBatchSize) {
			flush().catch(() => undefined);
		}
	};

	const flush = async () => {
		if (!enabled || pendingEvents.length === 0) {
			return;
		}

		const events = pendingEvents.splice(0, maxBatchSize);
		const body = JSON.stringify({ events });

		try {
			const canUseBeacon =
				browser.document.visibilityState === "hidden" &&
				typeof browser.navigator.sendBeacon === "function";
			if (
				canUseBeacon &&
				browser.navigator.sendBeacon?.(
					options.endpoint,
					new Blob([body], { type: "application/json" })
				)
			) {
				return;
			}

			const response = await fetch(options.endpoint, {
				body,
				credentials: "omit",
				headers: { "Content-Type": "application/json" },
				keepalive: true,
				method: "POST",
			});
			if (!response.ok) {
				throw new Error(`Performance event upload failed: ${response.status}`);
			}
		} catch {
			pendingEvents.unshift(...events);
		}
	};

	const observeWebVitals = () => {
		const Observer = browser.PerformanceObserver;
		if (!Observer) {
			return;
		}

		const observe = (
			type: string,
			onEntry: (entry: PerformanceEntryLike) => void
		) => {
			try {
				const observer = new Observer((list) => {
					for (const entry of list.getEntries()) {
						onEntry(entry);
					}
				});
				observer.observe({ buffered: true, type });
				observers.push(observer);
			} catch {
				// Older browsers may not support every observer entry type.
			}
		};

		observe("paint", (entry) => {
			if (entry.name === "first-contentful-paint") {
				queueEvent("web_vital", { fcpMs: safePositiveNumber(entry.startTime) });
			}
		});
		observe("largest-contentful-paint", (entry) => {
			queueEvent("web_vital", { lcpMs: safePositiveNumber(entry.startTime) });
		});
		observe("layout-shift", (entry) => {
			const layoutShift = entry as PerformanceEntryLike & {
				hadRecentInput?: boolean;
				value?: number;
			};
			if (!layoutShift.hadRecentInput) {
				queueEvent("web_vital", {
					cls: safePositiveNumber(layoutShift.value ?? 0),
				});
			}
		});
		observe("event", (entry) => {
			queueEvent("web_vital", { inpMs: safePositiveNumber(entry.duration) });
		});
	};

	const recordNavigationTiming = () => {
		const navigation = browser.performance.getEntriesByType("navigation")[0];
		if (!navigation) {
			return;
		}

		queueEvent("page_view", {
			durationMs: safePositiveNumber(navigation.duration),
		});
	};

	const onVisibilityChange = () => {
		if (browser.document.visibilityState === "hidden") {
			flush().catch(() => undefined);
		}
	};

	const start = () => {
		if (started) {
			return;
		}
		started = true;
		queueEvent("page_view");
		recordNavigationTiming();
		observeWebVitals();
		flushTimer = browser.window.setInterval(() => {
			flush().catch(() => undefined);
		}, flushIntervalMs);
		browser.document.addEventListener("visibilitychange", onVisibilityChange);
	};

	const stop = () => {
		if (!started) {
			return;
		}
		started = false;
		if (flushTimer !== undefined) {
			browser.window.clearInterval(flushTimer);
		}
		for (const observer of observers) {
			observer.disconnect();
		}
		observers.length = 0;
		browser.document.removeEventListener(
			"visibilitychange",
			onVisibilityChange
		);
		flush().catch(() => undefined);
	};

	const recordApiRequest = async (name: string, request: Promise<Response>) => {
		const startedAt = browser.performance.now();
		try {
			const response = await request;
			queueEvent("api_request", {
				apiName: name,
				apiStatus: response.status,
				durationMs: safePositiveNumber(browser.performance.now() - startedAt),
			});
			return response;
		} catch (error) {
			queueEvent("client_error", {
				durationMs: safePositiveNumber(browser.performance.now() - startedAt),
			});
			throw error;
		}
	};

	return { flush, recordApiRequest, start, stop };
};
