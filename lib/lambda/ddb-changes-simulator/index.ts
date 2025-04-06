import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const tableName = process.env.DYNAMODB_TABLE;
const changesCount = parseInt(process.env.CHANGES_COUNT || '1', 10);

type Action = 'upsert' | 'delete';
type Item = {
    id: string,
    name: string,
    timestamp: string,
};
type OperationResult = {
    action: Action;
    id: string;
    name?: string;
    timestamp?: string;
    status: 'success' | 'error';
    error?: string;
};

// Initialize DynamoDB clients
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Helper function to generate random name
const generateName = (): string => {
    const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank', 'Grace', 'Henry'];
    return names[Math.floor(Math.random() * names.length)];
};

// Helper function to generate random ID between 1-100
const generateId = (): string => {
    return String(Math.floor(Math.random() * 100) + 1);
};

// Helper function to get random action
const getRandomAction = (): Action => {
    const actions: Action[] = ['upsert', 'upsert', 'delete']; // 2:1 ratio favoring upsert
    return actions[Math.floor(Math.random() * actions.length)];
};

// Helper function to perform a single DynamoDB operation
const performOperation = async (
    tableName: string,
    action: Action,
    id: string,
    name?: string
): Promise<OperationResult> => {
    try {
        const timestamp = new Date().toISOString();

        switch (action) {
            case 'upsert':
                const item: Item = {
                    // id: {"S": id},
                    // name: {"S": name || generateName()},
                    // timestamp: {"S": timestamp},
                    id: id,
                    name: name || generateName(),
                    timestamp: timestamp
                };

                console.log({item})

                await docClient.send(
                    new PutCommand({
                        TableName: tableName,
                        Item: item
                    })
                );

                return {
                    action,
                    id,
                    name:  item.name,
                    timestamp,
                    status: 'success'
                };

            case 'delete':
                await docClient.send(
                    new DeleteCommand({
                        TableName: tableName,
                        Key: { id },
                    })
                );

                return {
                    action,
                    id,
                    status: 'success'
                };
        }
    } catch (error) {
        return {
            action,
            id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

export const handler = async (): Promise<{
    statusCode: number;
    body: string;
}> => {
    // Get configuration from environment variables
    if (!tableName) {
        throw new Error('DYNAMODB_TABLE environment variable is not set');
    }

    if (isNaN(changesCount) || changesCount < 1) {
        throw new Error('CHANGES_COUNT must be a positive number');
    }

    try {
        // Perform multiple operations based on CHANGES_COUNT
        const operationPromises: Promise<OperationResult>[] = [];

        for (let i = 0; i < changesCount; i++) {
            const action = getRandomAction();
            const id = generateId();
            operationPromises.push(performOperation(tableName, action, id));
        }

        // Wait for all operations to complete
        const results = await Promise.all(operationPromises);

        // Calculate success and error counts
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        // Determine overall status code
        const statusCode = errorCount === 0 ? 200 :
            successCount === 0 ? 500 : 207; // 207 Multi-Status

        return {
            statusCode,
            body: JSON.stringify({
                summary: {
                    totalOperations: changesCount,
                    successCount,
                    errorCount
                },
                operations: results
            }, null, 2)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error performing DynamoDB operations',
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        };
    }
};
