import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require("path");

export class MigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaRole = new cdk.aws_iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
      ]
    });

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'LambdaFunction', {
      entry: path.join(__dirname, '..', 'lambda/src/index.ts'),
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60 * 14),
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      role: lambdaRole,
    });

    new cdk.aws_logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${lambda.functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });

    new cdk.CfnOutput(this, 'LambdaArn', {
      value: lambda.functionArn,
      description: 'Lambda ARN',
      exportName: 'LambdaArn',
    });

    new cdk.CfnOutput(this, 'LambdaName', {
      value: lambda.functionName,
      description: 'Lambda name',
      exportName: 'LambdaName',
    });
  }
}
