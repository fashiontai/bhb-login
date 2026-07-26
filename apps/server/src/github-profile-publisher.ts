import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { env } from "@bhb-login/env/server";
import type { GithubProfileSavedEvent } from "./github-profile-events.js";

const snsClient = new SNSClient({});

export const publishGithubProfileSavedEvent = async (
	event: GithubProfileSavedEvent
) => {
	const topicArn = env.GITHUB_PROFILE_EVENTS_TOPIC_ARN;
	if (!topicArn) {
		return false;
	}

	await snsClient.send(
		new PublishCommand({
			Message: JSON.stringify(event),
			Subject: "GitHub profile saved",
			TopicArn: topicArn,
		})
	);

	return true;
};
