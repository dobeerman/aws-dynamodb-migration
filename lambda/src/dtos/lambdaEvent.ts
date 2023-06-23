import { TableNames } from "./tableNames";

export interface LambdaEvent extends TableNames {
  cleanupDestinationTable?: boolean;
  migrate?: boolean;
}
