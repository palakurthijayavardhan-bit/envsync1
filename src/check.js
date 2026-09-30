const { parseKeys } = require("./parse");

function checkMissing() {
  const exampleKeys = parseKeys(".env.example");
  const localKeys = parseKeys(".env");
  const missing = exampleKeys.filter(key => !localKeys.includes(key));

  if (missing.length > 0) {
    console.log("Missing keys in .env:");
    missing.forEach(key => console.log("  - " + key));
    process.exitCode = 1;
    return;
  }

  console.log("All keys present");
}

module.exports = { checkMissing };