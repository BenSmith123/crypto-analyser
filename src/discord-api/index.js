
/**
 * Seperate lambda function that uses the same helper functions as the crypto-analyser projects
 * This is set up through API gateway and can be invoked by URL or by discord commands
 *
 * API endpoint: https://csezryhvsa.execute-api.ap-southeast-2.amazonaws.com/prod
 *
 * Commands:
 *    /get-configuration
 *    /health-check
 *    /pause
 *    /unpause
 *    /changelog
 *    /list-available-crypto
 *    /set-sell-percentage
 *    /set-buy-percentage
 *    /force-sell
 *    /force-buy
 */

const nacl = require('tweetnacl');
require('dotenv').config();

const axios = require('axios');
const { logToDiscord } = require('../helpers');
const { loadInvestmentConfig, updateInvestmentConfig } = require('../database');
const { API_URL } = require('../environment');


const discordName = 'Crypto assistant';


// map of discord ID's and their database config ID
const discordUserConfigMap = {
	'409274228794458113': 'configuration',
	'234154409033072650': 'configuration-jett',
	'604242730268491787': 'configuration-zlatko',
};


// map discord command paths to their functions
const API_ENDPOINTS = {
	root: respondToPing,
	'health-check': checkCryptoApiStatus,
	changelog: getChangelog,
	'get-configuration': getConfigurationResponse,
	'list-available-crypto': listAvailableCrypto,
	pause: updateUserConfig,
	unpause: updateUserConfig,
	'set-buy-percentage': updateUserConfig,
	'set-sell-percentage': updateUserConfig,
};


// globals
let COMMAND;
let USER_NAME;
let ID;
let BODY;


exports.discordController = async function (event) {

	// await logToDiscord(event.body, true, discordName);

	console.log('event: ', JSON.stringify(event));

	try {

		if (!requestIsValid(event)) {
			return errorResponse(`Invalid request: ${JSON.stringify(event)}`, 401);
		}

		// get the requested endpoint via API gateway
		// const endpoint = event.pathParameters && event.pathParameters.endpoint
		// ? event.pathParameters.endpoint
		// : 'root';

		BODY = JSON.parse(event.body) || null;

		COMMAND = BODY?.data?.name || 'root';

		USER_NAME = BODY.member.user.username;
		ID = BODY.member.user.id;


		const content = await API_ENDPOINTS[COMMAND]();

		return {
			statusCode: 200,
			body: JSON.stringify({
				type: 4,
				data: {
					content,
				},
			}),
		};

	} catch (err) {

		// unexpected error scenario - log these
		await logToDiscord(`An unexpected error has occurred: ${err.message}\n\nStack: ${err.stack}\n\nDate: ${new Date().toLocaleString()}`, true, discordName);

		return {
			statusCode: 500,
			body: 'invalid request signature',
		};
	}

};


function errorResponse(err, statusCode = 400) {
	return {
		statusCode,
		body: err.message,
	};
}


function respondToPing() {
	return JSON.stringify({ type: 1 });
}


/**
 * Returns the input parameter of the discord slash command if it exists
 *
 * @param {string} name - name of the slash command parameter
 */
function getInputParam(name) {
	const options = BODY.data?.options;

	if (!options) return null;

	const param = options.find(option => (option.name === name));

	return param?.value || null;
}


function getChangelog() {

	const changelog = require('../data/changelog.json'); // eslint-disable-line global-require

	const results = [];

	changelog.logs.forEach(log => {
		results.push(`\nv${log.version}`);

		log.changes.forEach(change => {
			results.push(`   - ${change}`);
		});

		log.devChanges.forEach(change => {
			results.push(`   - [dev] ${change}`);
		});

	});

	return results.join('\n');
}


/**
 * Queries any crypto.com API endpoint and checks the data is valid
 */
async function checkCryptoApiStatus() {

	let isHealthy;

	try {
		const res = await axios(`${API_URL}public/get-instruments`);

		// even in status 200 scenarios the API can still return a 'maintenance page'
		isHealthy = res.data.result.instruments.length > 0;

	} catch (err) {
		isHealthy = false;
	}

	return isHealthy
		? 'Crypto.com exchange appears to be **healthy**'
		: 'Crypto.com exchange appears **down**!';
}


function requestIsValid({ headers, body }) {

	const { PUBLIC_KEY } = process.env;

	const signature = headers['x-signature-ed25519'];
	const timestamp = headers['x-signature-timestamp'];

	if (!signature || !timestamp) { return false; }

	return nacl.sign.detached.verify(
		Buffer.from(timestamp + body),
		Buffer.from(signature, 'hex'),
		Buffer.from(PUBLIC_KEY, 'hex'),
	);

}


/**
 * Returns the user database configuration
 *
 * @returns {object}
 */
async function getUserConfiguration() {

	const configId = discordUserConfigMap[ID];

	if (!configId) { throw new Error(`User does not exist: ID=${ID}`); }

	return loadInvestmentConfig(configId);
}


/**
 * Returns the user database configuration as formatted JSON
 */
async function getConfigurationResponse() {
	const config = await getUserConfiguration();
	return JSON.stringify(config, null, 4);
}


/**
 * Returns a list of the available crypto currencies on the crypto.com API
 * Available crypto currencies listed and can be traded into USDT
 */
async function listAvailableCrypto() {

	const res = await axios(`${API_URL}public/get-instruments`);

	const cryptoList = res.data.result.instruments
		.map(instrument => (instrument.instrument_name.includes('USDT')
			? instrument.base_currency
			: null))
		.filter(r => r !== null)
		.sort();

	return `${cryptoList.join('\n')}\n${cryptoList.length} total crypto currencies available`;
}


/**
 * Get the users database configuration, update field(s) based on the input command
 * Update configuration in the database and respond with a message
 */
async function updateUserConfig() {

	let responseMsg;
	let percentage;

	// validate commands that require input params before continuing
	if (COMMAND === 'set-buy-percentage' || COMMAND === 'set-sell-percentage') {
		percentage = getInputParam('percentage');

		if (!percentage || percentage <= 0) {
			return `Invalid input (${percentage}) - must be a positive number`;
		}
	}

	const config = await getUserConfiguration();

	if (COMMAND === 'pause') {
		config.isPaused = true;
		responseMsg = 'Your crypto-bot is now **paused**';
	}

	if (COMMAND === 'unpause') {
		config.isPaused = false;
		responseMsg = 'Your crypto-bot is now **unpaused**';
	}

	if (COMMAND === 'set-buy-percentage') {
		config.buyPercentage = percentage;
		responseMsg = `Your buy percentage is now **-${percentage}%** of the last sell price`;
	}

	if (COMMAND === 'set-sell-percentage') {
		config.sellPercentage = percentage;
		responseMsg = `Your sell percentage is now **+${percentage}%** of the last buy price`;
	}

	await updateInvestmentConfig(config);

	return responseMsg;
}
