const fs = require('fs');
const path = require('path');

// Path to build number file
const buildNumberFile = path.join(__dirname, '..', 'build-number.json');

// Read current build number or create it if it doesn't exist
let buildNumber = 1;
try {
  if (fs.existsSync(buildNumberFile)) {
    const data = fs.readFileSync(buildNumberFile, 'utf8');
    const buildData = JSON.parse(data);
    buildNumber = buildData.buildNumber || 1;
  }
} catch (err) {
  console.log('No existing build number found, starting at 1');
}

// Increment build number
buildNumber++;

// Write the updated build number
fs.writeFileSync(buildNumberFile, JSON.stringify({ buildNumber }, null, 2));

// Update environment with build number
process.env.BUILD_NUMBER = buildNumber.toString();

console.log(`Build number incremented to: ${buildNumber}`);

// Additionally, update the package.json with the new build info
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

// Extract major and minor version
const [major, minor] = packageJson.version.split('.');
const newVersion = `${major}.${minor}.${buildNumber}`;

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`Updated package.json version to: ${newVersion}`);