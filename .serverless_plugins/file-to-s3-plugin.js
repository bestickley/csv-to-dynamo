const AWS = require("aws-sdk");
const fsp = require("fs").promises;
const basename = require("path").basename

class FileToS3Plugin {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      "before:aws:deploy:finalize:cleanup": this.beforeAwsDeployFinalizeCleanup.bind(this),
    }
  }
  async beforeAwsDeployFinalizeCleanup() {
    const s3 = new AWS.S3(this.serverless.providers.aws.cachedCredentials);
    const filePath = this.serverless.service.custom.csvToDynamo.filePath
    let file;
    try {
      file = await fsp.readFile(filePath);
    } catch(e) {
      console.error("Error reading file from 'filePath' given from custom.csvToDynamo");
      console.error(e);
      process.exit(1);
    }
    let fileName = basename(filePath);
    try {
      await s3.upload({
        Bucket: this.serverless.service.custom.csvToDynamo.bucketName,
        Key: fileName,
        Body: file,
      }).promise();
    } catch(e) {
      console.error("Error putting object into S3");
      console.error(e);
      process.exit(1)
    }
    console.log("Upload Data Plugin complete");
  }
}

module.exports = FileToS3Plugin;