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
1. Check the csv-dev DynamoDB table and ensure it's filled

Notes:
- "file-to-s3-plugin" uploads the CSV at the file path specified in the `custom.csvToDynamo.filePath` within serverless.yaml
- "invoke-lambda-plugin" invokes the lambda by getting the "ServiceEnpoint" from the cloud formation stacks output and then the lambda function extracts the data from S3 and inserts the data into DynamoDB

## Bonus: Alexa Invocation Instructions
1. Create a developer account on developer.amazon.com/alexa
1. Create a custom skill
1. Copy Your Skill ID from: Build Tab > Custom > Endpoint and paste it into the `functions.s3ToDynamoSkill.event[1].alexaSkill.appId`
1. Copy alexa/interactionModel.json into: Build Tab > Custom > Interaction Model > JSON Editor
1. Copy the ARN of the `csv-to-dynamo-s3ToDynamoSkill` lambda function and paste it into: Build Tab > Custom > Endpoint > Default Region
1. Navigate to: Build Tab > Custom > Interfaces and click "Build Model"
1. Check the csv-skill-dev DynamoDB table and ensure it's empty
1. Go to the Test tab and say or type into the Alexa Simlator: "launch ben's lambda and parse my csv to dynamodb"
1. Check the csv-skill-dev DynamoDB table and ensure it's filled

To see Alexa in action, check out [this video](https://drive.google.com/open?id=1IWtEldeLvGpGxSXlDyhdgyKlNZ6pjCzZ)
