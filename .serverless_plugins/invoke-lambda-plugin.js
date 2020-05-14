const fetch = require("node-fetch");
const basename = require("path").basename

class InvokeLambda {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      "after:aws:deploy:finalize:cleanup": this.afterAwsDeployFinalizeCleanup.bind(this),
    }
  }
  async afterAwsDeployFinalizeCleanup() {
    /* Get Service Endpoint  */
    const res = await this.serverless.getProvider('aws').request(
      'CloudFormation',
      'describeStacks',
      { StackName: this.serverless.getProvider('aws').naming.getStackName() },
      "dev",
      "us-east-1"
    );
    let serviceEndpoint = "";
    for (const output of res.Stacks[0].Outputs) {
      if (output.OutputKey === "ServiceEndpoint") {
        serviceEndpoint = output.OutputValue;
        break;
      }
    }
    
    /* Invoke Lambda Function */
    try {
      // wait for lambda to spin up
      await new Promise((resolve) => setTimeout(() => resolve(), 5000));
      const res = await fetch(
        serviceEndpoint + "/put",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" }
        }
      );
      if (!res.ok) {
        console.error("failed Endpoint: " + serviceEndpoint + "/put");
        const error = await res.text();
        throw new Error(error);
      }
    } catch (e) {
      console.error("Error invoking lambda function");
      console.error(e)
      process.exit(1);
    }
    console.log("Invoke Lambda Plugin complete");
  }
}

module.exports = InvokeLambda;