/**
 * Single place for all environment variables to avoid mis-use and duplicate logic
 */

require('dotenv').config();

const { API_KEY, API_SECRET } = process.env;

const API_URL = process.env.API_URL || 'https://api.crypto.com/v2/';
// test API: https://uat-api.3ona.co/v2/

// transactions enabled if not specified
const TRANSACTIONS_ENABLED = (!process.env.TRANSACTIONS_ENABLED || process.env.TRANSACTIONS_ENABLED === 'true');

// in internal run mode no external calls are made (to the database or crypto API)
const INTERNAL_RUN = process.env.INTERNAL_RUN === 'true' || false;

// enable discord logs by default if not specified
const DISCORD_ENABLED = (!process.env.DISCORD_ENABLED || process.env.DISCORD_ENABLED === 'true');


module.exports = {
	API_URL,
	API_KEY,
	API_SECRET,
	TRANSACTIONS_ENABLED,
	INTERNAL_RUN,
	DISCORD_ENABLED,
};
