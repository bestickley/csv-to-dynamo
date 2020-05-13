'use strict';

const parse = require("csv-parse");
const AWS = require("aws-sdk");
const uuid = require("uuid");

function batchPutItems(ddbc, records) {
  const batchWriteItems = [];
  for (const item of records) {
    const batchWriteItem = {
      PutRequest: {
        Item: {
          pk: uuid.v4()
        }
      }
    };
    for (const [key, value] of Object.entries(item)) {
      if (value) batchWriteItem.PutRequest.Item[key] = value;
    }
    batchWriteItems.push(batchWriteItem);
  }
  return ddbc.batchWrite(
    { RequestItems: { [process.env.DYNAMODB_TABLE]: batchWriteItems } }
  ).promise();
}

module.exports.handler = async event => {

  /* Get CSV Object from S3 */
  const s3 = new AWS.S3({ region: process.env.REGION });
  const getS3ObjectPromise = s3.getObject({ Bucket: process.env.BUCKET, Key: process.env.BUCKET_KEY }).promise();

  /* Query All Items in Table and Batch Delete Old CSV */
  const batchDeletePromises = []
  const ddbc = new AWS.DynamoDB.DocumentClient();
  // typically prefer query over scan, but I need all pks to truncate table
  const scanResult = await ddbc.scan({ TableName: process.env.DYNAMODB_TABLE, ProjectionExpression: "pk"  }).promise();
  let oldBatchItems = [];
  for (const oldItem of scanResult.Items) {
    if ((oldBatchItems.length + 1) % 25 === 0) {
      const params = { RequestItems: { [process.env.DYNAMODB_TABLE]: oldBatchItems } };
      batchDeletePromises.push(ddbc.batchWrite(params).promise());
      oldBatchItems = [];
    } else {
      oldBatchItems.push({
        DeleteRequest: {
          Key: {
            "pk": oldItem.pk
          }
        }
      });
    }
  }

  let s3GetObjectOutput, batchDeleteResults;
  try {
    // don't care about the order of getting s3 object and resetting dynamodb table
    [s3GetObjectOutput, ...batchDeleteResults] = await Promise.all([getS3ObjectPromise, ...batchDeletePromises]);
  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error getting S3 object or batch deleting old DynamoDB table", error: err })
    }
  }
  
  const csv = s3GetObjectOutput.Body.toString("utf-8");

  /* Parse CSV and Send Put Requests to DynamoDB */
  const batchPutPromises = [];
  try {
    await new Promise((resolve, reject) => {
      const parser = parse({ columns: true });
      // when csv is readable, create a batch put request to dynamo db
      parser.on("readable", () => {
        // dynamo db batchWrite can only handle 25 items/request
        let record = {};
        let records = [];
        while(record = parser.read()) {
          records.push(record);
          if (records.length !== 0 && records.length % 25 === 0) {
            batchPutPromises.push(batchPutItems(ddbc, records));
            // reset records
            records = [];
          }
        }
        // put last records
        if (records.length) {
          batchPutPromises.push(batchPutItems(ddbc, records));
        }
      });
      parser.on("error", (err) => {
        reject(err);
      });
      parser.on("end", () => {
        resolve();
      });
      // write data to readable stream
      parser.write(csv);
      // close readable stream
      parser.end();
    });
  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error parsing CSV", error: err })
    }
  }

  try {
    await Promise.all(batchPutPromises);
  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error batch putting items", error: err })
    }
  }

  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'CSV from S3 successfully written to DynamoDB' }),
  };
};
