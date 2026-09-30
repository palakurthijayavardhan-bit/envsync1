const { generateExample } = require("../src/generate");
const { checkMissing } = require("../src/check");

const command = process.argv[2];

if (command === "init") {
  generateExample();
} else if (command === "check") {
  checkMissing();
} else {
  console.log("Usage: node bin/envsync.js <init|check>");
}