import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaEvent } from "./dtos/lambdaEvent";
import { DynamoDBModule } from "./modules/dynamodb";

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1";

const logger = new Logger({ serviceName: process.env.AWS_LAMBDA_FUNCTION_NAME });
const client = new DynamoDBClient({ region });
const ddbModule = new DynamoDBModule(client, logger);

export const handler = async (event: LambdaEvent) => {
  try {
    await ddbModule.cleanupDestinationTable(event);
    await ddbModule.migrate(event);
  } catch (error) {
    logger.error("Error while migrating", { error });
  }
};
