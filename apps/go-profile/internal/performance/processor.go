package performance

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
)

type EventBatch struct {
	Events        []Event `json:"events"`
	ReceivedAt    string  `json:"receivedAt"`
	RequestID     string  `json:"requestId"`
	SchemaVersion int     `json:"schemaVersion"`
}

type Event struct {
	AnonymousID string  `json:"anonymousId"`
	EventType   string  `json:"eventType"`
	Metrics     Metrics `json:"metrics"`
	OccurredAt  string  `json:"occurredAt"`
	Release     string  `json:"release"`
	Route       string  `json:"route"`
	SDKVersion  string  `json:"sdkVersion"`
}

type Metrics struct {
	APIName    string  `json:"apiName,omitempty"`
	APIStatus  int     `json:"apiStatus,omitempty"`
	CLS        float64 `json:"cls,omitempty"`
	DurationMS float64 `json:"durationMs,omitempty"`
	FCPMS      float64 `json:"fcpMs,omitempty"`
	INPMS      float64 `json:"inpMs,omitempty"`
	LCPMS      float64 `json:"lcpMs,omitempty"`
}

type Processor struct {
	client   *sqs.Client
	queueURL string
	store    BatchStore
}

type BatchStore interface {
	SavePerformanceBatch(context.Context, EventBatch) error
}

func NewProcessor(client *sqs.Client, queueURL string, dataStore BatchStore) *Processor {
	return &Processor{client: client, queueURL: queueURL, store: dataStore}
}

func (processor *Processor) Run(ctx context.Context) error {
	if strings.TrimSpace(processor.queueURL) == "" {
		return fmt.Errorf("performance queue URL is required")
	}

	for {
		if err := processor.receiveBatch(ctx); err != nil {
			if ctx.Err() != nil {
				return nil
			}
			slog.Error("performance worker receive failed", "error", err)
			time.Sleep(5 * time.Second)
		}
	}
}

func (processor *Processor) receiveBatch(ctx context.Context) error {
	result, err := processor.client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
		AttributeNames:      []types.QueueAttributeName{types.QueueAttributeName("ApproximateReceiveCount")},
		MaxNumberOfMessages: 10,
		QueueUrl:            aws.String(processor.queueURL),
		WaitTimeSeconds:     20,
		VisibilityTimeout:   180,
	})
	if err != nil {
		return err
	}

	for _, message := range result.Messages {
		if message.Body == nil || message.ReceiptHandle == nil {
			continue
		}

		var batch EventBatch
		if err := json.Unmarshal([]byte(*message.Body), &batch); err != nil {
			return fmt.Errorf("decode performance event batch: %w", err)
		}
		if err := processor.store.SavePerformanceBatch(ctx, batch); err != nil {
			return err
		}
		if _, err := processor.client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
			QueueUrl:      aws.String(processor.queueURL),
			ReceiptHandle: message.ReceiptHandle,
		}); err != nil {
			return fmt.Errorf("delete processed performance message: %w", err)
		}
	}

	return nil
}
