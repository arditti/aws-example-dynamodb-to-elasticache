import {Construct} from "constructs";
import * as cdk from "aws-cdk-lib";


export class DDBChangesSimulator extends Construct {

    constructor(scope: Construct, id: string, table: cdk.aws_dynamodb.Table) {
        super(scope, id);

        const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'ddb-changes-simulator-lambda', {
            entry: 'lib/lambda/ddb-changes-simulator/index.ts',
            handler: 'handler',
            runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
            timeout: cdk.Duration.seconds(60),
            architecture: cdk.aws_lambda.Architecture.ARM_64,
            environment: {
                DYNAMODB_TABLE: table.tableName,
                CHANGES_COUNT: '10'
            },
        });

        table.grantWriteData(lambda);
        new cdk.aws_events.Rule(this, 'ddb-changes-simulator-rule', {
            schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(1)),
            targets: [new cdk.aws_events_targets.LambdaFunction(lambda)]
        });

    }
}

