import { DynamoDBStreamEvent } from 'aws-lambda';
import { Redis } from 'ioredis';

const redisConfig = {
    host: process.env.ELASTICACHE_HOST,
    port: Number(process.env.ELASTICACHE_PORT),
    tls:{}
}

console.log('redis config', redisConfig)

const redis = new Redis(redisConfig);

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    for (const record of event.Records) {
        if (!record.dynamodb) continue;
        const { NewImage, OldImage } = record.dynamodb;
        const { eventName } = record;
        const { id, name } = NewImage || OldImage; // id and name are the keys withing the origin ddb table
        console.log('event', eventName, id, name);
        switch (eventName) {
            case 'INSERT':
            case 'MODIFY':
                await redis.set(id.S, name.S);
                break;
            case 'REMOVE':
                await redis.del(id.S);
                break;
        }
    }
}