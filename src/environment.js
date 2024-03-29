/**
 * Single place for all environment variables to avoid mis-use and duplicate logic
 */

require('dotenv').config();

const { API_KEY, API_SECRET, USER_ID } = process.env;

const DATETIME_FORMAT = 'DD/MM/YYYY, HH:mma';

const API_URL = process.env.API_URL || 'https://api.crypto.com/v2/';
// test API: https://uat-api.3ona.co/v2/

// enable discord logs by default if not specified
const DISCORD_ENABLED = (!process.env.DISCORD_ENABLED || process.env.DISCORD_ENABLED === 'true');

// const discordApi = 'https://discord.com/api/webhooks';

// default log to my channels
const { DISCORD_URL_ALERTS } = process.env;
const { DISCORD_URL_LOGS } = process.env;
// TODO ^ should this be moved to database config instead?

// transactions enabled if not specified
const TRANSACTIONS_ENABLED = (!process.env.TRANSACTIONS_ENABLED || process.env.TRANSACTIONS_ENABLED === 'true');

const CONSOLE_LOG = process.env.CONSOLE_LOG === 'true' || false;

module.exports = {
	API_URL,
	API_KEY,
	API_SECRET,
	USER_ID,
	DATETIME_FORMAT,
	DISCORD_ENABLED,
	DISCORD_URL_ALERTS,
	DISCORD_URL_LOGS,
	// debug stuff
	TRANSACTIONS_ENABLED,
	CONSOLE_LOG,
};
