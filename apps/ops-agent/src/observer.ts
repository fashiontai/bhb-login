import {
	CloudWatchClient,
	DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";
import {
	DescribeClustersCommand,
	DescribeServicesCommand,
	ECSClient,
} from "@aws-sdk/client-ecs";
import {
	DescribeTargetHealthCommand,
	ElasticLoadBalancingV2Client,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { GetAliasCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { DescribeDBClustersCommand, RDSClient } from "@aws-sdk/client-rds";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";

interface RecordValue {
	[key: string]: unknown;
}

interface SqsRecord {
	body: string;
	messageId: string;
}

interface SqsEvent {
	Records: SqsRecord[];
}

interface AlarmStateChangeEvent {
	alarmName?: string;
	detailType: string;
	source: string;
	stateReason?: string;
	stateTimestamp?: string;
	stateValue?: string;
}

interface ObservationSection {
	error?: string;
	status: "ok" | "error";
	value?: unknown;
}

export interface ObservationSnapshot {
	event: AlarmStateChangeEvent;
	failedChecks: string[];
	observedAt: string;
	resources: {
		alarm: ObservationSection;
		alb: ObservationSection;
		database: ObservationSection;
		ecs: ObservationSection;
		lambdaAlias: ObservationSection;
		queues: ObservationSection;
	};
	type: "ops.observation.completed";
}

const cloudWatch = new CloudWatchClient({});
const ecs = new ECSClient({});
const elb = new ElasticLoadBalancingV2Client({});
const lambda = new LambdaClient({});
const rds = new RDSClient({});
const sqs = new SQSClient({});

const env = {
	apiFunctionName: process.env.OPS_API_FUNCTION_NAME ?? "",
	apiAliasName: process.env.OPS_API_ALIAS_NAME ?? "live",
	ecsClusterName: process.env.OPS_ECS_CLUSTER_NAME ?? "",
	ecsServiceName: process.env.OPS_ECS_SERVICE_NAME ?? "",
	goTargetGroupArn: process.env.OPS_GO_TARGET_GROUP_ARN ?? "",
	databaseClusterIdentifier: process.env.OPS_DATABASE_CLUSTER_IDENTIFIER ?? "",
	githubEventsQueueUrl: process.env.OPS_GITHUB_EVENTS_QUEUE_URL ?? "",
	githubEventsDlqUrl: process.env.OPS_GITHUB_EVENTS_DLQ_URL ?? "",
};

const isRecord = (value: unknown): value is RecordValue =>
	typeof value === "object" && value !== null;

const stringValue = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const parseJson = (value: string): unknown => {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return;
	}
};

const unwrapEvent = (body: string): unknown => {
	const parsed = parseJson(body);
	if (!isRecord(parsed)) {
		return;
	}

	const snsMessage = parsed.Message;
	if (typeof snsMessage === "string") {
		return parseJson(snsMessage);
	}

	return parsed;
};

export const parseAlarmStateChangeEvent = (
	body: string
): AlarmStateChangeEvent => {
	const event = unwrapEvent(body);
	if (!isRecord(event)) {
		throw new Error("Observer received a non-object event payload");
	}

	const detail = isRecord(event.detail) ? event.detail : {};
	const state = isRecord(detail.state) ? detail.state : {};

	return {
		source: stringValue(event.source) ?? "unknown",
		detailType: stringValue(event["detail-type"]) ?? "unknown",
		alarmName: stringValue(detail.alarmName),
		stateValue: stringValue(state.value),
		stateReason: stringValue(state.reason),
		stateTimestamp: stringValue(state.timestamp),
	};
};

const readSection = async (
	name: string,
	read: () => Promise<unknown>
): Promise<[string, ObservationSection]> => {
	try {
		return [name, { status: "ok", value: await read() }];
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return [name, { status: "error", error: message }];
	}
};

const describeAlarm = async (
	event: AlarmStateChangeEvent
): Promise<unknown> => {
	if (!event.alarmName) {
		return { skipped: true, reason: "event did not contain alarmName" };
	}

	const response = await cloudWatch.send(
		new DescribeAlarmsCommand({ AlarmNames: [event.alarmName] })
	);
	const alarm = response.MetricAlarms?.[0];
	return {
		alarmName: alarm?.AlarmName ?? event.alarmName,
		stateValue: alarm?.StateValue,
		stateReason: alarm?.StateReason,
		stateUpdatedTimestamp: alarm?.StateUpdatedTimestamp,
		metricName: alarm?.MetricName,
		namespace: alarm?.Namespace,
		threshold: alarm?.Threshold,
	};
};

const describeLambdaAlias = async (): Promise<unknown> => {
	if (!env.apiFunctionName) {
		return { skipped: true, reason: "OPS_API_FUNCTION_NAME is not configured" };
	}

	const response = await lambda.send(
		new GetAliasCommand({
			FunctionName: env.apiFunctionName,
			Name: env.apiAliasName,
		})
	);
	return {
		functionName: env.apiFunctionName,
		aliasName: env.apiAliasName,
		functionVersion: response.FunctionVersion,
		routingConfig: response.RoutingConfig,
	};
};

const describeEcs = async (): Promise<unknown> => {
	if (!(env.ecsClusterName && env.ecsServiceName)) {
		return { skipped: true, reason: "ECS identifiers are not configured" };
	}

	const [clusterResponse, serviceResponse] = await Promise.all([
		ecs.send(new DescribeClustersCommand({ clusters: [env.ecsClusterName] })),
		ecs.send(
			new DescribeServicesCommand({
				cluster: env.ecsClusterName,
				services: [env.ecsServiceName],
			})
		),
	]);
	const service = serviceResponse.services?.[0];

	return {
		cluster: clusterResponse.clusters?.[0]
			? {
					status: clusterResponse.clusters[0].status,
					activeServicesCount: clusterResponse.clusters[0].activeServicesCount,
					runningTasksCount: clusterResponse.clusters[0].runningTasksCount,
				}
			: undefined,
		service: service
			? {
					status: service.status,
					runningCount: service.runningCount,
					desiredCount: service.desiredCount,
					pendingCount: service.pendingCount,
					rolloutState: service.deployments?.[0]?.rolloutState,
					taskDefinition: service.taskDefinition,
				}
			: undefined,
	};
};

const describeAlb = async (): Promise<unknown> => {
	if (!env.goTargetGroupArn) {
		return {
			skipped: true,
			reason: "OPS_GO_TARGET_GROUP_ARN is not configured",
		};
	}

	const response = await elb.send(
		new DescribeTargetHealthCommand({ TargetGroupArn: env.goTargetGroupArn })
	);
	const states = response.TargetHealthDescriptions?.reduce<
		Record<string, number>
	>((counts, target) => {
		const state = target.TargetHealth?.State ?? "unknown";
		counts[state] = (counts[state] ?? 0) + 1;
		return counts;
	}, {});
	return {
		targetGroupArn: env.goTargetGroupArn,
		targetCount: response.TargetHealthDescriptions?.length ?? 0,
		states,
	};
};

const describeDatabase = async (): Promise<unknown> => {
	if (!env.databaseClusterIdentifier) {
		return {
			skipped: true,
			reason: "OPS_DATABASE_CLUSTER_IDENTIFIER is not configured",
		};
	}

	const response = await rds.send(
		new DescribeDBClustersCommand({
			DBClusterIdentifier: env.databaseClusterIdentifier,
		})
	);
	const cluster = response.DBClusters?.[0];
	return {
		identifier: cluster?.DBClusterIdentifier,
		status: cluster?.Status,
		engine: cluster?.Engine,
		engineVersion: cluster?.EngineVersion,
		endpoint: cluster?.Endpoint,
		readerEndpoint: cluster?.ReaderEndpoint,
		members: cluster?.DBClusterMembers?.map((member) => ({
			instanceIdentifier: member.DBInstanceIdentifier,
			isClusterWriter: member.IsClusterWriter,
		})),
	};
};

const describeQueue = async (queueUrl: string): Promise<unknown> => {
	const response = await sqs.send(
		new GetQueueAttributesCommand({
			QueueUrl: queueUrl,
			AttributeNames: [
				"ApproximateNumberOfMessages",
				"ApproximateNumberOfMessagesNotVisible",
				"ApproximateNumberOfMessagesDelayed",
			],
		})
	);
	return {
		queueUrl,
		visible: response.Attributes?.ApproximateNumberOfMessages ?? "0",
		inFlight: response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? "0",
		delayed: response.Attributes?.ApproximateNumberOfMessagesDelayed ?? "0",
	};
};

const describeQueues = async (): Promise<unknown> => {
	const queues = await Promise.all(
		[
			["githubProfileEvents", env.githubEventsQueueUrl],
			["githubProfileEventsDlq", env.githubEventsDlqUrl],
		].map(async ([name, url]) => {
			if (!url) {
				return [name, { skipped: true }] as const;
			}
			return [name, await describeQueue(url)] as const;
		})
	);
	return Object.fromEntries(queues);
};

export const observe = async (
	event: AlarmStateChangeEvent
): Promise<ObservationSnapshot> => {
	const entries = await Promise.all([
		readSection("alarm", () => describeAlarm(event)),
		readSection("lambdaAlias", describeLambdaAlias),
		readSection("ecs", describeEcs),
		readSection("alb", describeAlb),
		readSection("database", describeDatabase),
		readSection("queues", describeQueues),
	]);
	const sections = Object.fromEntries(entries);
	const failedChecks = Object.entries(sections)
		.filter(([, section]) => section.status === "error")
		.map(([name]) => name);
	const getSection = (name: string): ObservationSection =>
		sections[name] ?? {
			status: "error",
			error: `Observer did not produce section: ${name}`,
		};

	return {
		type: "ops.observation.completed",
		observedAt: new Date().toISOString(),
		event,
		resources: {
			alarm: getSection("alarm"),
			lambdaAlias: getSection("lambdaAlias"),
			ecs: getSection("ecs"),
			alb: getSection("alb"),
			database: getSection("database"),
			queues: getSection("queues"),
		},
		failedChecks,
	};
};

export const handler = async (event: SqsEvent) => {
	const batchItemFailures: Array<{ itemIdentifier: string }> = [];

	for (const record of event.Records) {
		try {
			const alarmEvent = parseAlarmStateChangeEvent(record.body);
			const snapshot = await observe(alarmEvent);
			console.info(JSON.stringify(snapshot));
		} catch (error) {
			console.error("Observer failed to process event", {
				error: error instanceof Error ? error.message : String(error),
				messageId: record.messageId,
			});
			batchItemFailures.push({ itemIdentifier: record.messageId });
		}
	}

	return { batchItemFailures };
};
