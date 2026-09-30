const fs = require("fs");

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/);
}

function keys(lines) {
  return new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=", 1)[0].trim())
  );
}

const exampleLines = readLines(".env.example");
const requiredKeys = keys(exampleLines);
const envLines = readLines(".env");
const existingKeys = keys(envLines);
const missingKeys = [...requiredKeys].filter((key) => !existingKeys.has(key));

if (missingKeys.length) {
  fs.appendFileSync(".env", (envLines.length ? "\n" : "") + missingKeys.map((key) => `${key}=`).join("\n") + "\n");
  console.log("Added missing key names to .env:");
  missingKeys.forEach((key) => console.log(`- ${key}`));
} else {
  console.log("All required keys are already in .env.");
}