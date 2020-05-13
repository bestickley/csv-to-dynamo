# Exercise – Going Serverless
Build a serverless framework (serverless.com) deployment that creates a Lambda, an S3 bucket, and a
Dynamo DB table and uploads a file to your bucket. Then, write a plugin that invokes the Lambda after
the deployment, extracts data from the file in S3 and inserts that data into DynamoDB. Be creative. Show
off. Make it interesting.

_Assumes Node.js 12.X installed and AWS credentials stored locally_

## Deployment Instructions
1. Install Serverless Framework globally: `npm i -g serverless`
1. Install dependencies: `npm i`
1. Deploy: `serverless deploy`

Notes:
- "file-to-s3-plugin" uploads the CSV at the file path specified in the `custom.csvToDynamo.filePath` within serverless.yaml
- "invoke-lambda-plugin" invokes the lambda by getting the "ServiceEnpoint" from the cloud formation stacks output and then the lambda function extracts the data from S3 and inserts the data into DynamoDB

## Debug Instructions
1. Update .vscode/launch.json `program` property with serverless program
1. Update src/tests/event.json with data to be passed to lambda function
1. Add a breakpoint
1. Hit F5 in VS Code