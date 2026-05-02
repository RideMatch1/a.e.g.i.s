// Legitimate top-level spawn in a build-time config file. next.config.js
// is consumed by the bundler at build time, not at request time; the
// scanner must skip *.config.{js,ts,mjs,cjs} basenames so legitimate
// build-time codegen / env validation is not flagged.
const { spawnSync } = require('child_process');

const versionResult = spawnSync('git', ['rev-parse', '--short', 'HEAD']);
const COMMIT_SHA = versionResult.stdout.toString().trim();

module.exports = {
  env: {
    COMMIT_SHA,
  },
};
