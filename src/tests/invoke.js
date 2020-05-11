const fetch = require("node-fetch");
(async () => {
  try {
    const res = await fetch(
      "https://7vl7cx5wmc.execute-api.us-east-1.amazonaws.com/dev/put",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Bucket: "csv-dev", Key: "brazil_covid19.csv" })
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
  } catch (e) {
    console.error("Error invoking lambda function");
    console.error(e);
    process.exit(1);
  }
})();