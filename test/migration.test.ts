import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { MigrationStack } from "../lib/migration-stack";

describe("MigrationStack", () => {
  let app: cdk.App;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    const stack = new MigrationStack(app, "MigrationStack");
    template = Template.fromStack(stack);
  });

  test("LambdRole", () => template.hasResourceProperties("AWS::IAM::Role", {
    AssumeRolePolicyDocument: {
      Statement: [{ Action: "sts:AssumeRole", Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" } }],
      Version: "2012-10-17"
    },
    ManagedPolicyArns: [
      { "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]] },
      { "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":iam::aws:policy/AmazonDynamoDBFullAccess"]] }
    ]
  }));

  test("LambdFunction", () => template.hasResourceProperties("AWS::Lambda::Function", {
    Architectures: ["arm64"],
    Environment: { Variables: { AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1", } },
    Handler: "index.handler",
    MemorySize: 1024,
    Runtime: "nodejs18.x",
    Timeout: 840
  }));

  test("LogGroup", () => template.hasResourceProperties("AWS::Logs::LogGroup", {
    LogGroupName: { "Fn::Join": ["", ["/aws/lambda/", { Ref: Match.stringLikeRegexp("^LambdaFunction[A-F0-9]{8}$") }]] },
    RetentionInDays: 1
  }));

  test("Outputs", () => {
    const json = template.toJSON();
    expect(json.Outputs).toEqual({
      LambdaArn: {
        Description: "Lambda ARN",
        Value: { "Fn::GetAtt": [expect.stringMatching(/^LambdaFunction[A-F0-9]{8}$/), "Arn"] },
        Export: { Name: "LambdaArn" }
      },
      LambdaName: {
        Description: "Lambda name",
        Value: { Ref: expect.stringMatching(/^LambdaFunction[A-F0-9]{8}$/) },
        Export: { Name: "LambdaName" }
      }
    });
  });
})

