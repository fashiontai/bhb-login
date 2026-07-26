import { z } from "zod";

const githubProfileSavedEventSchema = z.object({
	eventId: z.uuid(),
	eventType: z.literal("github.profile.saved"),
	githubAccountId: z.string().min(1),
	githubId: z.number().int(),
	login: z.string().min(1),
	occurredAt: z.iso.datetime(),
	userId: z.string().min(1),
});

export type GithubProfileSavedEvent = z.infer<
	typeof githubProfileSavedEventSchema
>;

export interface SqsRecord {
	body: string;
	messageId: string;
}

export interface SqsEvent {
	Records: SqsRecord[];
}

export const githubProfileEventWorkerHandler = (event: SqsEvent) => {
	const batchItemFailures: Array<{ itemIdentifier: string }> = [];

	for (const record of event.Records) {
		try {
			const payload = githubProfileSavedEventSchema.parse(
				JSON.parse(record.body)
			);
			console.info("Processed GitHub profile event", {
				eventId: payload.eventId,
				githubAccountId: payload.githubAccountId,
				login: payload.login,
			});
		} catch (error) {
			console.error("Failed to process GitHub profile event", {
				error,
				messageId: record.messageId,
			});
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	return { batchItemFailures };
};
