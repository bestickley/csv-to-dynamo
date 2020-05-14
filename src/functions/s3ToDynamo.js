'use strict';

const parse = require("csv-parse");
const AWS = require("aws-sdk");
const uuid = require("uuid");

/* Get CSV string from S3 */
async function getCsv(s3, bucket, key) {
  const response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
  return response.Body.toString("utf-8");
}

/* Get all primary keys in Dynamo DB Table */
async function getAllPks(ddbc, tableName) {
  const scanResult = await ddbc.scan({ TableName: tableName, ProjectionExpression: "pk"  }).promise();
  return scanResult.Items.map((i) => i.pk);
}

/* Batch delete all items in Dynamo DB Table */
function batchDeleteTable(ddbc, pks, tableName) {
  const batchDeletePromises = [];
  let batchRequests = [];
  for (const pk of pks) {
    if ((batchRequests.length + 1) % 25 === 0) {
      batchDeletePromises.push(
        ddbc.batchWrite({ RequestItems: { [tableName]: batchRequests } }).promise()
      );
      batchRequests = [];
    } else {
      batchRequests.push({
        DeleteRequest: {
          Key: {
            "pk": pk
          }
        }
      });
    }
  }
  if (batchRequests.length) {
    batchDeletePromises.push(
      ddbc.batchWrite({ RequestItems: { [tableName]: batchRequests } }).promise()
    );
  }
  return batchDeletePromises;
}

async function parseCsv(ddbc, tableName, csv) {
  return new Promise((resolve, reject) => {
    const batchPutPromises = [];
    const parser = parse({ columns: true });
    // when csv is readable, create a batch put request to dynamo db
    parser.on("readable", () => {
      // dynamo db batchWrite can only handle 25 items/request
      let record = {};
      let records = [];
      while(record = parser.read()) {
        records.push(record);
        if (records.length !== 0 && records.length % 25 === 0) {
          batchPutPromises.push(batchPutItems(ddbc, records, tableName));
          // reset records
          records = [];
        }
      }
      // put last records
      if (records.length) {
        batchPutPromises.push(batchPutItems(ddbc, records, tableName));
      }
    });
    parser.on("error", (err) => {
      reject(err);
    });
    parser.on("end", () => {
      resolve(batchPutPromises);
    });
    // write data to readable stream
    parser.write(csv);
    // close readable stream
    parser.end();
  });
}

function batchPutItems(ddbc, records, tableName) {
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
  return ddbc.batchWrite({ RequestItems: { [tableName]: batchWriteItems } })
    .promise();
}

async function s3ToDynamo(s3, ddbc, tableName) {

  const getCsvPromise = getCsv(s3, process.env.BUCKET, process.env.BUCKET_KEY);

  const allPks = await getAllPks(ddbc, tableName);

  const batchDeletePromises = batchDeleteTable(ddbc, allPks, tableName);

  let csv, batchDeleteResponses;
  try {
    // don't care about the order of getting s3 object and resetting dynamodb table
    [csv, ...batchDeleteResponses] = await Promise.all([getCsvPromise, ...batchDeletePromises]);
  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error getting S3 object or batch deleting old DynamoDB table", error: err })
    }
  }
  

  /* Parse CSV and Send Put Requests to DynamoDB */
  let batchPutPromises = [];
  try {
    batchPutPromises = await parseCsv(ddbc, tableName, csv);
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

async function handler(event) {
  // initialize AWS services
  const s3 = new AWS.S3({ region: process.env.REGION });
  const ddbc = new AWS.DynamoDB.DocumentClient();
  return await s3ToDynamo(s3, ddbc, process.env.DYNAMODB_TABLE);
}

module.exports = {
  handler,
  s3ToDynamo,
}