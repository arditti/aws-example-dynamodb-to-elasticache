import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {DynamoDBStreamsToLambda} from '@aws-solutions-constructs/aws-dynamodbstreams-lambda';
import {Duration} from "aws-cdk-lib";
import {SecurityGroups, VPC} from "./vpc";
import {DDBChangesSimulator} from "./ddb-changes-simulator";

export class AwsExampleDynamodbToElasticacheStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new VPC(this, 'vpc');
        const securityGroups = new SecurityGroups(this, 'sg', vpc.vpc);
        // origin DynamoDB table
        const originDdbTable = new cdk.aws_dynamodb.Table(this, 'origin-ddb', {
            partitionKey: {name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING},
            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            stream: cdk.aws_dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // destination elasticache serverless
        const destinationEcSls = new cdk.aws_elasticache.CfnServerlessCache(this, 'destination-ec-sls', {
            engine: 'Valkey',
            serverlessCacheName: 'dynamodb-to-elasticache',
            subnetIds: vpc.vpc.isolatedSubnets.map((subnet) => subnet.subnetId),
            securityGroupIds: [securityGroups.elasticacheSG.securityGroupId],
        });

        // replicating lambda
        const replicatingLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'replicating-lambda', {
            entry: 'lib/lambda/dynamodb-to-elasticache/index.ts',
            handler: 'handler',
            runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
            timeout: cdk.Duration.seconds(5),
            architecture: cdk.aws_lambda.Architecture.ARM_64,
            vpc: vpc.vpc,
            vpcSubnets: {subnetType: cdk.aws_ec2.SubnetType.PRIVATE_ISOLATED},
            securityGroups: [securityGroups.lambdaSG],
            environment: {
                ELASTICACHE_HOST: destinationEcSls.attrEndpointAddress,
                ELASTICACHE_PORT: destinationEcSls.attrEndpointPort
            },
        });


        new DynamoDBStreamsToLambda(this, 'ddb-stream-to-lambda-2', {
            existingTableInterface: originDdbTable,
            existingLambdaObj: replicatingLambda,
            deploySqsDlqQueue: false, // disable DLQ in order to preserve msgs order
            dynamoEventSourceProps: {
                startingPosition: cdk.aws_lambda.StartingPosition.TRIM_HORIZON,
                batchSize: 1, // in order to avoid partial batch
                retryAttempts: 2,
                maxRecordAge: Duration.hours(24) // DynamoDB stream max age
            }
        });

        new DDBChangesSimulator(this, 'ddb-changes-simulator', originDdbTable);

    }
}
