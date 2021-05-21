/**
 * Single place for all environment variables to avoid mis-use and duplicate logic
 */

require('dotenv').config();

const { API_KEY, API_SECRET, DATABASE_ID } = process.env;

const DATETIME_FORMAT = 'DD/MM/YYYY, HH:mma';

const API_URL = process.env.API_URL || 'https://api.crypto.com/v2/';
// test API: https://uat-api.3ona.co/v2/

// enable discord logs by default if not specified
const DISCORD_ENABLED = (!process.env.DISCORD_ENABLED || process.env.DISCORD_ENABLED === 'true');

const discordApi = 'https://discord.com/api/webhooks';

// default log to my channels
const DISCORD_URL_ALERTS = process.env.DISCORD_URL_ALERTS || `${discordApi}/834201420302647306/3UyU72vcsRwstQmYjiMxb-5d7YSIDNDu1QWz2vMg_Y5nQsP5X05vgMr-PvYqma15MinZ`;
const DISCORD_URL_LOGS = process.env.DISCORD_URL_LOGS || `${discordApi}/834182612419346432/0cvHHmrCE0tXAGmzr_l4RgGvEl7LhVgd4cej0g_rOjSrhcKcEjoyAYkRIh-lJHa0FnPy`;
// TODO ^ should this be moved to database config instead?

// transactions enabled if not specified
const TRANSACTIONS_ENABLED = (!process.env.TRANSACTIONS_ENABLED || process.env.TRANSACTIONS_ENABLED === 'true');

// in internal run mode no external calls are made (to the database or crypto API)
const INTERNAL_RUN = process.env.INTERNAL_RUN === 'true' || false;

module.exports = {
	API_URL,
	API_KEY,
	API_SECRET,
	DATABASE_ID,
	DATETIME_FORMAT,
	DISCORD_ENABLED,
	DISCORD_URL_ALERTS,
	DISCORD_URL_LOGS,
	// debug stuff
	TRANSACTIONS_ENABLED,
	INTERNAL_RUN,
};
