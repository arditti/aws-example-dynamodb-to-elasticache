import {Construct} from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {SecurityGroup} from "aws-cdk-lib/aws-ec2";


export class VPC extends Construct {
    public readonly vpc: ec2.Vpc;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        this.vpc = new ec2.Vpc(this, 'MainVPC', {
            ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
            maxAzs: 3,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                }
            ],
        });
    }
}

export class SecurityGroups extends Construct {
    public lambdaSG: SecurityGroup;
    public elasticacheSG: SecurityGroup;

    constructor(scope: Construct, id: string, vpc: ec2.Vpc) {
        super(scope, id);
        this.lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', {
            vpc,
            allowAllOutbound: true,
        });
        this.elasticacheSG = new ec2.SecurityGroup(this, 'ElasticacheSG', {
            vpc,
            allowAllOutbound: true,
        });
        this.elasticacheSG.addIngressRule(this.lambdaSG, ec2.Port.tcp(6379), 'Allow Redis from Lambda'); // Hardcoded redis port
    }
}
