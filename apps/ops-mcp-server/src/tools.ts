import {
	CloudWatchClient,
	DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";
import {
	CloudWatchLogsClient,
	FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
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

export interface OpsMcpConfig {
	apiAliasName: string;
	apiFunctionName: string;
	applicationStackName: string;
	databaseClusterIdentifier: string;
	ecsClusterName: string;
	ecsServiceName: string;
	githubEventsDlqUrl: string;
	githubEventsQueueUrl: string;
	goTargetGroupArn: string;
	logGroups: Record<string, string>;
}

interface AwsClients {
	cloudWatch: CloudWatchClient;
	ecs: ECSClient;
	elb: ElasticLoadBalancingV2Client;
	lambda: LambdaClient;
	logs: CloudWatchLogsClient;
	rds: RDSClient;
	sqs: SQSClient;
}

const requiredEnv = (name: string): string => {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
};

export const loadOpsMcpConfig = (): OpsMcpConfig => {
	const applicationStackName =
		process.env.OPS_APPLICATION_STACK_NAME?.trim() || "bhb-login";
	return {
		apiAliasName: process.env.OPS_API_ALIAS_NAME?.trim() || "live",
		apiFunctionName: requiredEnv("OPS_API_FUNCTION_NAME"),
		applicationStackName,
		databaseClusterIdentifier: requiredEnv("OPS_DATABASE_CLUSTER_IDENTIFIER"),
		ecsClusterName: requiredEnv("OPS_ECS_CLUSTER_NAME"),
		ecsServiceName: requiredEnv("OPS_ECS_SERVICE_NAME"),
		githubEventsDlqUrl: requiredEnv("OPS_GITHUB_EVENTS_DLQ_URL"),
		githubEventsQueueUrl: requiredEnv("OPS_GITHUB_EVENTS_QUEUE_URL"),
		goTargetGroupArn: requiredEnv("OPS_GO_TARGET_GROUP_ARN"),
		logGroups: {
			api: `/aws/lambda/${applicationStackName}-api`,
			go: `/ecs/${applicationStackName}/go-profile`,
			observer: `/aws/lambda/${applicationStackName}-ops-observer`,
			processor: `/ecs/${applicationStackName}/performance-processor`,
			release: `/aws/lambda/${applicationStackName}-ops-release`,
			triage: `/aws/lambda/${applicationStackName}-ops-triage`,
		},
	};
};

const createAwsClients = (): AwsClients => ({
	cloudWatch: new CloudWatchClient({}),
	ecs: new ECSClient({}),
	elb: new ElasticLoadBalancingV2Client({}),
	lambda: new LambdaClient({}),
	logs: new CloudWatchLogsClient({}),
	rds: new RDSClient({}),
	sqs: new SQSClient({}),
});

const clients = createAwsClients();

export const getAlarmHealth = async (alarmName?: string): Promise<unknown> => {
	if (!alarmName) {
		return { skipped: true, reason: "alarmName was not provided" };
	}
	const response = await clients.cloudWatch.send(
		new DescribeAlarmsCommand({ AlarmNames: [alarmName] })
	);
	const alarm = response.MetricAlarms?.[0];
	return {
		alarmName,
		metricName: alarm?.MetricName,
		namespace: alarm?.Namespace,
		stateReason: alarm?.StateReason,
		stateUpdatedTimestamp: alarm?.StateUpdatedTimestamp,
		stateValue: alarm?.StateValue,
		threshold: alarm?.Threshold,
	};
};

export const getLambdaAliasHealth = async (
	config: OpsMcpConfig
): Promise<unknown> => {
	const response = await clients.lambda.send(
		new GetAliasCommand({
			FunctionName: config.apiFunctionName,
			Name: config.apiAliasName,
		})
	);
	return {
		aliasName: config.apiAliasName,
		functionName: config.apiFunctionName,
		functionVersion: response.FunctionVersion,
		routingConfig: response.RoutingConfig,
	};
};

export const getEcsServiceHealth = async (
	config: OpsMcpConfig
): Promise<unknown> => {
	const [clusterResponse, serviceResponse] = await Promise.all([
		clients.ecs.send(
			new DescribeClustersCommand({ clusters: [config.ecsClusterName] })
		),
		clients.ecs.send(
			new DescribeServicesCommand({
				cluster: config.ecsClusterName,
				services: [config.ecsServiceName],
			})
		),
	]);
	const cluster = clusterResponse.clusters?.[0];
	const service = serviceResponse.services?.[0];
	return {
		cluster: cluster
			? {
					activeServicesCount: cluster.activeServicesCount,
					runningTasksCount: cluster.runningTasksCount,
					status: cluster.status,
				}
			: undefined,
		service: service
			? {
					desiredCount: service.desiredCount,
					pendingCount: service.pendingCount,
					rolloutState: service.deployments?.[0]?.rolloutState,
					runningCount: service.runningCount,
					status: service.status,
					taskDefinition: service.taskDefinition,
				}
			: undefined,
	};
};

export const getAlbTargetHealth = async (
	config: OpsMcpConfig
): Promise<unknown> => {
	const response = await clients.elb.send(
		new DescribeTargetHealthCommand({
			TargetGroupArn: config.goTargetGroupArn,
		})
	);
	const targets = response.TargetHealthDescriptions ?? [];
	const states: Record<string, number> = {};
	for (const item of targets) {
		const state = item.TargetHealth?.State ?? "unknown";
		states[state] = (states[state] ?? 0) + 1;
	}
	return {
		states,
		targetCount: targets.length,
		targets: targets.map((item) => ({
			description: item.TargetHealth?.Description,
			id: item.Target?.Id,
			port: item.Target?.Port,
			reason: item.TargetHealth?.Reason,
			state: item.TargetHealth?.State,
		})),
	};
};

export const getDatabaseHealth = async (
	config: OpsMcpConfig
): Promise<unknown> => {
	const response = await clients.rds.send(
		new DescribeDBClustersCommand({
			DBClusterIdentifier: config.databaseClusterIdentifier,
		})
	);
	const cluster = response.DBClusters?.[0];
	return {
		capacity: cluster?.Capacity,
		databaseName: cluster?.DatabaseName,
		engine: cluster?.Engine,
		engineMode: cluster?.EngineMode,
		engineVersion: cluster?.EngineVersion,
		identifier: cluster?.DBClusterIdentifier,
		serverlessV2ScalingConfiguration: cluster?.ServerlessV2ScalingConfiguration,
		status: cluster?.Status,
	};
};

const getQueueAttributes = async (queueUrl: string): Promise<unknown> => {
	const response = await clients.sqs.send(
		new GetQueueAttributesCommand({
			AttributeNames: [
				"ApproximateNumberOfMessages",
				"ApproximateNumberOfMessagesDelayed",
				"ApproximateNumberOfMessagesNotVisible",
				"CreatedTimestamp",
				"LastModifiedTimestamp",
				"QueueArn",
			],
			QueueUrl: queueUrl,
		})
	);
	return {
		delayed: response.Attributes?.ApproximateNumberOfMessagesDelayed,
		inFlight: response.Attributes?.ApproximateNumberOfMessagesNotVisible,
		queueArn: response.Attributes?.QueueArn,
		visible: response.Attributes?.ApproximateNumberOfMessages,
	};
};

export const getQueueHealth = async (
	config: OpsMcpConfig
): Promise<unknown> => ({
	githubProfileEvents: await getQueueAttributes(config.githubEventsQueueUrl),
	githubProfileEventsDlq: await getQueueAttributes(config.githubEventsDlqUrl),
});

export const getRecentLogs = async (
	config: OpsMcpConfig,
	input: {
		filterPattern?: string;
		limit: number;
		minutes: number;
		service: string;
	}
): Promise<unknown> => {
	const logGroupName = config.logGroups[input.service];
	if (!logGroupName) {
		throw new Error(`Unsupported service log group: ${input.service}`);
	}
	const endTime = Date.now();
	const startTime = endTime - input.minutes * 60_000;
	const response = await clients.logs.send(
		new FilterLogEventsCommand({
			endTime,
			filterPattern: input.filterPattern || undefined,
			limit: input.limit,
			logGroupName,
			startTime,
		})
	);
	return {
		events: (response.events ?? []).map((event) => ({
			ingestionTime: event.ingestionTime,
			message: event.message,
			timestamp: event.timestamp,
		})),
		logGroupName,
		window: { endTime, startTime },
	};
};

const readSection = async (
	name: string,
	read: () => Promise<unknown>
): Promise<
	[string, { error?: string; status: "error" | "ok"; value?: unknown }]
> => {
	try {
		return [name, { status: "ok", value: await read() }];
	} catch (error) {
		return [
			name,
			{
				error: error instanceof Error ? error.message : String(error),
				status: "error",
			},
		];
	}
};

export const collectIncidentContext = async (
	config: OpsMcpConfig,
	input: { alarmName?: string; includeLogs: boolean; logMinutes: number }
): Promise<unknown> => {
	const entries = await Promise.all([
		readSection("alarm", () => getAlarmHealth(input.alarmName)),
		readSection("lambdaAlias", () => getLambdaAliasHealth(config)),
		readSection("ecs", () => getEcsServiceHealth(config)),
		readSection("alb", () => getAlbTargetHealth(config)),
		readSection("database", () => getDatabaseHealth(config)),
		readSection("queues", () => getQueueHealth(config)),
		...(input.includeLogs
			? [
					readSection("apiErrors", () =>
						getRecentLogs(config, {
							filterPattern: "?ERROR ?Error ?Exception",
							limit: 20,
							minutes: input.logMinutes,
							service: "api",
						})
					),
					readSection("goErrors", () =>
						getRecentLogs(config, {
							filterPattern: "?ERROR ?Error ?panic",
							limit: 20,
							minutes: input.logMinutes,
							service: "go",
						})
					),
				]
			: []),
	]);
	return {
		collectedAt: new Date().toISOString(),
		resources: Object.fromEntries(entries),
		type: "ops.mcp.context.collected",
	};
};
