import { Logger } from "@aws-lambda-powertools/logger";
import {
  AttributeValue,
  BatchWriteItemCommand,
  BatchWriteItemCommandOutput,
  BatchWriteItemInput,
  BatchWriteItemOutput,
  DescribeTableCommand,
  DescribeTableCommandInput,
  DescribeTableCommandOutput,
  DynamoDBClient,
  ScanCommand,
  ScanCommandInput,
  ScanCommandOutput
} from "@aws-sdk/client-dynamodb";
import { LambdaEvent } from "../dtos/lambdaEvent";
import { RetryDetails } from "../dtos/retryDetails";

export class DynamoDBModule {
  private readonly scanInput: Pick<ScanCommandInput, "Select" | "ReturnConsumedCapacity" | "Limit"> = {
    Select: "ALL_ATTRIBUTES",
    ReturnConsumedCapacity: "TOTAL",
  };

  constructor(
    private readonly client: DynamoDBClient,
    private readonly logger: Logger,
    private readonly retryDetails: RetryDetails = { delayInMs: 100, retryLimit: 10, scanLimit: 1000 },
  ) {
    this.scanInput.Limit = this.retryDetails.scanLimit;
  }

  public async cleanupDestinationTable(event: LambdaEvent): Promise<void> {
    if (!event.cleanupDestinationTable) {
      this.logger.debug("Cleanup destination table is not enabled");
      return;
    }

    const tableDescription: DescribeTableCommandOutput = await this.describeTable(event.destinationTableName);

    if (!tableDescription.Table) {
      throw new Error(`Table ${event.destinationTableName} not found`);
    }

    if (!tableDescription.Table.KeySchema) {
      throw new Error(`Table ${event.destinationTableName} has no key schema`);
    }

    const keySchema: string[] = tableDescription.Table.KeySchema.map(attribute => attribute.AttributeName!);

    const input: ScanCommandInput = {
      ...this.scanInput,
      TableName: event.destinationTableName,
      Select: "SPECIFIC_ATTRIBUTES",
      AttributesToGet: keySchema,
    };

    await this.exec(input, event.destinationTableName);
  }

  public async migrate(event: LambdaEvent): Promise<void> {
    if (!event.migrate) {
      this.logger.debug("Migrate is not enabled");
      return;
    }

    const input: ScanCommandInput = { ...this.scanInput, TableName: event.sourceTableName, };

    await this.exec(input, event.destinationTableName);
  }

  private async exec(input: ScanCommandInput, tableName: string) {
    let nextToken: Record<string, AttributeValue> | undefined = { is: { S: "undefined" } };

    while (nextToken) {
      if (nextToken.is) { nextToken = undefined; }

      input.ExclusiveStartKey = nextToken;

      const scanResponse: ScanCommandOutput = await this.client.send(new ScanCommand(input));

      nextToken = scanResponse.LastEvaluatedKey;

      const chunks: Record<string, AttributeValue>[][] = this.chunk(scanResponse.Items ?? [], 25);

      for (const chunk of chunks) {
        const requestItems: BatchWriteItemInput["RequestItems"] = {
          [tableName]: chunk.map(item => tableName !== input.TableName ? { PutRequest: { Item: item } } : { DeleteRequest: { Key: item } })
        };
        await this.batchWriteWithRetry({ RequestItems: requestItems });
      };
    }
  }

  private async describeTable(tableName: string): Promise<DescribeTableCommandOutput> {
    const input: DescribeTableCommandInput = { TableName: tableName };

    const command = new DescribeTableCommand(input);

    return await this.client.send(command);
  }

  protected async delay(ms: number, attempt: number): Promise<void> {
    const exponentialDelay = ms * (2 * attempt);

    const randomDelay = Math.floor(Math.random() * (exponentialDelay - ms)) + ms;

    return new Promise(resolve => setTimeout(resolve, randomDelay));
  }

  private async batchWriteWithRetry(batchWriteItemInput: BatchWriteItemInput, retryCount: number = 0,): Promise<BatchWriteItemOutput> {
    if (retryCount > 0) {
      await this.delay(this.retryDetails.delayInMs, retryCount);
    }

    const command: BatchWriteItemCommand = new BatchWriteItemCommand(batchWriteItemInput);

    const batchResponse: BatchWriteItemCommandOutput = await this.client.send(command);

    const unprocessedItems: string[] = Object.keys(batchResponse.UnprocessedItems ?? {});

    if (unprocessedItems.length !== 0 && retryCount < this.retryDetails.retryLimit) {
      this.logger.warn(`UnprocessedItems.length: ${unprocessedItems.length}.`);

      retryCount++;

      const response: BatchWriteItemOutput = await this.batchWriteWithRetry({ RequestItems: batchResponse.UnprocessedItems }, retryCount);

      return response;
    }

    if (unprocessedItems.length !== 0 && retryCount === this.retryDetails.retryLimit) {
      this.logger.error(`Retry limit reached. UnprocessedItems.length: ${unprocessedItems.length}.`);
    }

    return batchResponse;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return [...Array(Math.ceil(arr.length / size))].map((_, i) => arr.slice(size * i, size + size * i));
  }
}
