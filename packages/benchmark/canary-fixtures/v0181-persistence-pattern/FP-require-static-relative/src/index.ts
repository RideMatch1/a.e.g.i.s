// Legitimate top-level require: static literal path, fully auditable.
// This is the canonical CommonJS module-import shape; flagging it would
// produce noise on every legacy codebase.
const config = require('./config.json');
const helper = require('./helpers/util');
const lib = require('lodash');

module.exports = { config, helper, lib };
