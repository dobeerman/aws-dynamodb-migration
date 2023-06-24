import { Logger } from "@aws-lambda-powertools/logger";
import { handler } from "../../../lambda/src";
import { LambdaEvent } from "../../../lambda/src/dtos/lambdaEvent";
import { DynamoDBModule } from "../../../lambda/src/modules/dynamodb";

describe("Lambda handler test", () => {
  let cleanupDestinationTableSpy: jest.Mock;
  let migrateSpy: jest.Mock;
  let loggerSpy: jest.Mock;
  let event: LambdaEvent;

  beforeEach(() => {
    cleanupDestinationTableSpy = jest.fn();
    DynamoDBModule.prototype.cleanupDestinationTable = cleanupDestinationTableSpy;

    migrateSpy = jest.fn();
    DynamoDBModule.prototype.migrate = migrateSpy;

    loggerSpy = jest.fn();
    Logger.prototype.error = loggerSpy;

    event = {
      sourceTableName: "sourceTableName",
      destinationTableName: "destinationTableName",
      cleanupDestinationTable: true,
      migrate: true,
    };
  });

  afterEach(jest.clearAllMocks);

  test("Should call cleanupDestinationTable and migrate", async () => {
    await handler(event);

    expect(cleanupDestinationTableSpy).toHaveBeenCalledWith(event);
    expect(migrateSpy).toHaveBeenCalledWith(event);
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  test("Should throw error on cleanupDestinationTable failure", async () => {
    DynamoDBModule.prototype.cleanupDestinationTable = jest.fn().mockRejectedValue(new Error("cleanupDestinationTable error"));

    await handler(event);

    expect(loggerSpy).toHaveBeenCalledWith("Error while migrating", { error: Error("cleanupDestinationTable error") });
  });

  test("Should throw error on migrate failure", async () => {
    DynamoDBModule.prototype.migrate = jest.fn().mockRejectedValue(new Error("migrate error"));

    await handler(event);

    expect(loggerSpy).toHaveBeenCalledWith("Error while migrating", { error: Error("migrate error") });
  });
});
