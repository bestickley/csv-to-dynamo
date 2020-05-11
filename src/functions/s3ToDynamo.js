'use strict';

const parse = require("csv-parse");
const AWS = require("aws-sdk");
const uuid = require("uuid");

module.exports.upload = async event => {
  /* Get CSV Object from S3 */
  const { Bucket, Key } = JSON.parse(event.body);
  const s3 = new AWS.S3({ region: process.env.REGION });
  let s3Data;
  try {
    s3Data = await s3.getObject({ Bucket, Key }).promise();
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error getting object from S3", error: e})
    }
  }
  const csv = s3Data.Body.toString("utf-8");

  /* Parse CSV */
  let items;
  try {
    items = await new Promise((resolve, reject) => {
      parse(csv, { columns: true }, (err, records, info) => {
        if (err) {
          reject(err);
        } else {
          resolve(records);
        }
      });
    });
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error parsing CSV", error: e })
    }
  }

  /* Query All Items in Table and Batch Delete Old CSV */
  const ddbc = new AWS.DynamoDB.DocumentClient();
  const scanResult = await ddbc.scan({ TableName: process.env.DYNAMODB_TABLE }).promise();
  let oldBatchItems = [];
  for (const oldItem of scanResult.Items) {
    if ((oldBatchItems.length + 1) % 25 === 0) {
      const params = { RequestItems: { [process.env.DYNAMODB_TABLE]: oldBatchItems } };
      try {
        await ddbc.batchWrite(params).promise();
        oldBatchItems = [];
      } catch(e) {
        return {
          statusCode: 500,
          body: JSON.stringify({ message: "Error batch deleting items", error: e })
        }
      }
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

  /* Batch Put New CSV Items */
  let batchItems = [];
  for (const item of items) {
    if ((batchItems.length + 1) % 25 === 0) {
      const params = { RequestItems: { [process.env.DYNAMODB_TABLE]: batchItems } };
      try {
        await ddbc.batchWrite(params).promise();
        batchItems = []
      } catch(e) {
        return {
          statusCode: 500,
          body: JSON.stringify({ message: "Error batch putting items", error: e })
        }
      }
    } else {
      const batchItem = {
        PutRequest: {
          Item: {
            pk: uuid.v4()
          }
        }
      };
      for (const [key, value] of Object.entries(item)) {
        if (value) batchItem.PutRequest.Item[key] = value;
      }
      batchItems.push(batchItem)
    }
  }
  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'Data successfully written to DynamoDB' }),
  };
};
