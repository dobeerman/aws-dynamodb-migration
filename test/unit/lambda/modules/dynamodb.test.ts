import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaEvent } from "../../../../lambda/src/dtos/lambdaEvent";
import { DynamoDBModule } from "../../../../lambda/src/modules/dynamodb";

describe("DynamoDBModule", () => {
  let dynamodbModule: DynamoDBModule;
  let dynamoDBClientSendSpy: jest.Mock;
  let loggerDebugSpy: jest.Mock;
  let loggerWarnSpy: jest.Mock;
  let loggerErrorSpy: jest.Mock;
  let event: LambdaEvent;


  beforeEach(() => {
    dynamoDBClientSendSpy = jest.fn();
    DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    loggerDebugSpy = jest.fn();
    Logger.prototype.debug = loggerDebugSpy;
    loggerWarnSpy = jest.fn();
    Logger.prototype.warn = loggerWarnSpy;
    loggerErrorSpy = jest.fn();
    Logger.prototype.error = loggerErrorSpy;

    dynamodbModule = new DynamoDBModule(DynamoDBClient.prototype, Logger.prototype);

    event = {
      sourceTableName: "sourceTableName",
      destinationTableName: "destinationTableName",
      cleanupDestinationTable: true,
      migrate: true,
    };
  });

  afterEach(jest.clearAllMocks);

  test("Should not cleanup", async () => {
    // Assign
    event.cleanupDestinationTable = false;

    // Act
    await dynamodbModule.cleanupDestinationTable(event);

    // Assert
    expect(loggerDebugSpy).toHaveBeenCalledWith("Skipping cleanup of destination table");
  });

  test("Should throw error when desribed Table is undefined", async () => {
    // Assign
    DynamoDBClient.prototype.send = jest.fn().mockResolvedValue({});

    // Act & Assert
    await expect(dynamodbModule.cleanupDestinationTable(event)).rejects.toThrowError("Table destinationTableName not found");
  });

  test("Should throw error when desribed Table's key schema is undefined", async () => {
    // Assign
    DynamoDBClient.prototype.send = jest.fn().mockResolvedValue({ Table: { KeySchema: undefined } });

    // Act & Assert
    await expect(dynamodbModule.cleanupDestinationTable(event)).rejects.toThrowError("Table destinationTableName has no key schema");
  });

  test("Should clean the destination table with correct params", async () => {
    // Assign
    dynamoDBClientSendSpy = jest.fn().mockResolvedValueOnce({
      Table: {
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ]
      }
    }).mockResolvedValueOnce({ Items: [{ pk: "pk1", sk: "sk1" }, { pk: "pk2", sk: "sk2" }, { pk: "pk3", sk: "sk3" },], LastEvaluatedKey: undefined, }).mockResolvedValueOnce({});
    // @ts-ignore
    const execSpy = jest.spyOn(DynamoDBModule.prototype, 'exec');
    DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    // Act
    await dynamodbModule.cleanupDestinationTable(event);

    // Assert
    expect(execSpy).toHaveBeenCalledWith({
      AttributesToGet: ["pk", "sk"],
      Limit: 1000,
      ReturnConsumedCapacity: "TOTAL",
      Select: "SPECIFIC_ATTRIBUTES",
      TableName: "destinationTableName"
    },
      "destinationTableName"
    );
  });

  test("Should not migrate", async () => {
    // Assign
    event.migrate = false;

    // Act
    await dynamodbModule.migrate(event);

    // Assert
    expect(loggerDebugSpy).toHaveBeenCalledWith("Skipping migration of data");
  });

  test("Should migrate with correct params", async () => {
    // Assign
    dynamoDBClientSendSpy = jest.fn().mockResolvedValueOnce({
      Table: {
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ]
      }
    }).mockResolvedValueOnce({ Items: [{ pk: "pk1", sk: "sk1" }, { pk: "pk2", sk: "sk2" }, { pk: "pk3", sk: "sk3" },], LastEvaluatedKey: undefined, }).mockResolvedValueOnce({});
    // @ts-ignore
    const execSpy = jest.spyOn(DynamoDBModule.prototype, 'exec');
    DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    // Act
    await dynamodbModule.migrate(event);

    // Assert
    expect(execSpy).toHaveBeenCalledWith({
      Limit: 1000,
      ReturnConsumedCapacity: "TOTAL",
      Select: "ALL_ATTRIBUTES",
      TableName: "sourceTableName"
    },
      "destinationTableName"
    );
  });

  test("Should call batchWriteWithRetry method with correct DeleteRequest params When cleaning up the destination table", async () => {
    // Assign
    // @ts-ignore
    const batchWriteWithRetrySpy = jest.spyOn(DynamoDBModule.prototype, 'batchWriteWithRetry');

    dynamoDBClientSendSpy = jest.fn().mockResolvedValueOnce({
      Table: {
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ]
      }
    }).mockResolvedValueOnce({ Items: [{ pk: "pk1", sk: "sk1" }, { pk: "pk2", sk: "sk2" }, { pk: "pk3", sk: "sk3" },], LastEvaluatedKey: undefined, }).mockResolvedValueOnce({}); DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    // Act
    await dynamodbModule.cleanupDestinationTable(event);

    // Assert
    expect(batchWriteWithRetrySpy).toHaveBeenCalledWith({
      "RequestItems": {
        "destinationTableName": [
          { "DeleteRequest": { "Key": { "pk": "pk1", "sk": "sk1" } } },
          { "DeleteRequest": { "Key": { "pk": "pk2", "sk": "sk2" } } },
          { "DeleteRequest": { "Key": { "pk": "pk3", "sk": "sk3" } } }
        ]
      }
    });
  });

  test("Should call batchWriteWithRetry method with correct PutRequest params When migrating", async () => {
    // Assign
    // @ts-ignore
    const batchWriteWithRetrySpy = jest.spyOn(DynamoDBModule.prototype, 'batchWriteWithRetry');
    dynamoDBClientSendSpy = jest.fn().mockResolvedValueOnce({
      Items: [
        { pk: "pk1", sk: "sk1" },
        { pk: "pk2", sk: "sk2" },
        { pk: "pk3", sk: "sk3" },
      ],
      LastEvaluatedKey: undefined
    }).mockResolvedValueOnce({});

    DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    // Act
    await dynamodbModule.migrate(event);

    // Assert
    expect(batchWriteWithRetrySpy).toHaveBeenCalledWith({
      RequestItems: {
        destinationTableName: [
          { PutRequest: { Item: { pk: "pk1", sk: "sk1", }, }, },
          { PutRequest: { Item: { pk: "pk2", sk: "sk2", }, }, },
          { PutRequest: { Item: { pk: "pk3", sk: "sk3", }, }, },
        ],
      },
    });
  });

  test("Should retry if batchWriteWithRetry returns unprocessed items", async () => {
    // Assign
    // @ts-ignore
    const batchWriteWithRetrySpy = jest.spyOn(DynamoDBModule.prototype, 'batchWriteWithRetry');
    dynamoDBClientSendSpy = jest.fn().mockResolvedValueOnce({
      Items: [
        { pk: "pk1", sk: "sk1" },
        { pk: "pk2", sk: "sk2" },
        { pk: "pk3", sk: "sk3" },
      ],
      LastEvaluatedKey: undefined
    }).mockResolvedValueOnce({
      UnprocessedItems: {
        destinationTableName: [
          { PutRequest: { Item: { pk: "pk3", sk: "sk3", }, }, },
        ],
      }
    }).mockResolvedValueOnce({});

    DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    // Act
    await dynamodbModule.migrate(event);

    // Assert
    expect(batchWriteWithRetrySpy).toHaveBeenNthCalledWith(1, {
      RequestItems: {
        destinationTableName: [
          { PutRequest: { Item: { pk: "pk1", sk: "sk1", } } },
          { PutRequest: { Item: { pk: "pk2", sk: "sk2", } } },
          { PutRequest: { Item: { pk: "pk3", sk: "sk3", } } },
        ],
      },
    });
    expect(batchWriteWithRetrySpy).toHaveBeenNthCalledWith(2, {
      RequestItems: {
        destinationTableName: [
          { PutRequest: { Item: { pk: "pk3", sk: "sk3" } } }]
      }
    }, 1);
  });

  test("Should log error if batchWriteWithRetry reached retry limit", async () => {
    // Assign
    // @ts-ignore
    const batchWriteWithRetrySpy = jest.spyOn(DynamoDBModule.prototype, 'batchWriteWithRetry');
    dynamoDBClientSendSpy = jest.fn().mockResolvedValueOnce({
      Items: [
        { pk: "pk1", sk: "sk1" },
        { pk: "pk2", sk: "sk2" },
        { pk: "pk3", sk: "sk3" },
      ],
      LastEvaluatedKey: undefined
    }).mockResolvedValue({
      UnprocessedItems: {
        destinationTableName: [
          { PutRequest: { Item: { pk: "pk3", sk: "sk3", }, }, },
        ],
      }
    });

    dynamodbModule = new DynamoDBModule(DynamoDBClient.prototype, Logger.prototype, {
      delayInMs: 1,
      retryLimit: 2,
      scanLimit: 10
    });

    DynamoDBClient.prototype.send = dynamoDBClientSendSpy;

    // Act
    await dynamodbModule.migrate(event);

    // Assert
    expect(batchWriteWithRetrySpy).toHaveBeenCalledTimes(3);
    expect(batchWriteWithRetrySpy).toHaveBeenNthCalledWith(1, {
      RequestItems: {
        destinationTableName: [
          { PutRequest: { Item: { pk: "pk1", sk: "sk1", } } },
          { PutRequest: { Item: { pk: "pk2", sk: "sk2", } } },
          { PutRequest: { Item: { pk: "pk3", sk: "sk3", } } },
        ],
      },
    });
    expect(batchWriteWithRetrySpy).toHaveBeenNthCalledWith(2, {
      RequestItems: {
        destinationTableName: [{ PutRequest: { Item: { pk: "pk3", sk: "sk3" } } }]
      }
    }, 1);
    expect(batchWriteWithRetrySpy).toHaveBeenNthCalledWith(3, {
      RequestItems: {
        destinationTableName: [{ PutRequest: { Item: { pk: "pk3", sk: "sk3" } } }]
      }
    }, 2);
    expect(loggerErrorSpy).toHaveBeenCalledWith("Retry limit reached. UnprocessedItems.length: 1.");
  });
});
