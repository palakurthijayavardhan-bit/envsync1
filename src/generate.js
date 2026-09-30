const fs = require("fs");
const { parseKeys } = require("./parse");

function generateExample() {
  const keys = parseKeys(".env");
  const content = keys.map(key => `${key}=`).join("\n") + "\n";

  fs.writeFileSync(".env.example", content);
  console.log(`.env.example generated with ${keys.length} keys (values removed)`);
}

module.exports = { generateExample };