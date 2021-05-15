
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
	'get-configuration': getConfigurationResponse,
	'list-available-crypto': listAvailableCrypto,
	pause: updateUserConfig,
	unpause: updateUserConfig,
};


// globals
let COMMAND;
let USER_NAME;
let ID;


exports.discordController = async function (event) {

	console.log('event: ', JSON.stringify(event));

	try {

		if (!requestIsValid(event)) {
			return errorResponse(`Invalid request: ${JSON.stringify(event)}`, 401);
		}

		// get the requested endpoint via API gateway
		// const endpoint = event.pathParameters && event.pathParameters.endpoint
		// ? event.pathParameters.endpoint
		// : 'root';

		const body = JSON.parse(event.body) || null;

		COMMAND = body?.data?.name || 'root';

		USER_NAME = body.member.user.username;
		ID = body.member.user.id;


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
 */
async function listAvailableCrypto() {

	const res = await axios(`${API_URL}public/get-instruments`);

	return res.data.result.instruments
		.map(instrument => instrument.base_currency)
		.join('\n');
}


/**
 * Get the users database configuration, update field(s) based on the input command
 * Update configuration in the database and respond with a message
 */
async function updateUserConfig() {

	let responseMsg;

	const config = await getUserConfiguration();

	if (COMMAND === 'pause') {
		config.isPaused = true;
		responseMsg = 'Your crypto-bot is now **paused.**';
	}

	if (COMMAND === 'unpause') {
		config.isPaused = false;
		responseMsg = 'Your crypto-bot is now **unpaused.**';
	}

	await updateInvestmentConfig(config);

	return responseMsg;
}
