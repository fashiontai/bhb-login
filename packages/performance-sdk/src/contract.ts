import { z } from "zod";

export const performanceEventTypeSchema = z.enum([
	"page_view",
	"web_vital",
	"api_request",
	"client_error",
]);

export const performanceMetricsSchema = z
	.object({
		apiName: z.string().min(1).max(128).optional(),
		apiStatus: z.number().int().min(100).max(599).optional(),
		cls: z.number().finite().min(0).max(10).optional(),
		durationMs: z.number().finite().min(0).max(300_000).optional(),
		fcpMs: z.number().finite().min(0).max(300_000).optional(),
		inpMs: z.number().finite().min(0).max(300_000).optional(),
		lcpMs: z.number().finite().min(0).max(300_000).optional(),
	})
	.refine((metrics) => Object.keys(metrics).length > 0, {
		message: "At least one metric is required.",
	});

export const performanceEventSchema = z
	.object({
		anonymousId: z.string().min(1).max(128),
		eventType: performanceEventTypeSchema,
		metrics: performanceMetricsSchema.optional(),
		occurredAt: z.iso.datetime(),
		release: z.string().max(128).optional(),
		route: z.string().min(1).max(256),
		sdkVersion: z.string().min(1).max(32),
	})
	.refine((event) => event.eventType === "page_view" || event.metrics, {
		message: "Metrics are required for non-page-view events.",
	});

export const performanceBatchSchema = z.object({
	events: z.array(performanceEventSchema).min(1).max(20),
});

export type PerformanceEvent = z.infer<typeof performanceEventSchema>;
export type PerformanceEventType = z.infer<typeof performanceEventTypeSchema>;
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;
