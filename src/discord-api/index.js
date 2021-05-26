
/**
 * Seperate lambda function that uses the same helper functions as the crypto-analyser projects
 * This is set up through API gateway and can be invoked by URL or by discord commands
 *
 * API endpoint: https://csezryhvsa.execute-api.ap-southeast-2.amazonaws.com/prod
 *
 * Commands:
 *    /changelog
 *    /change-crypto
 *    /force-sell
 *    /force-buy
 *    /get-configuration
 *    /health-check
 *    /list-available-crypto
 *    /pause
 *    /set-buy-percentage
 *    /set-sell-percentage
 *    /set-sell-warning
 *    /unpause
 */

require('dotenv').config();

const { respondToPing, errorResponse, requestIsValid, getUserConfiguration } = require('./discord-helpers');
const { getChangelog, checkCryptoApiStatus, getAvailableCrypto } = require('./slash-commands');
const { updateInvestmentConfig } = require('../database');
const { logToDiscord } = require('../helpers');


const discordName = 'Crypto assistant';


// map discord command paths to their functions
const API_ENDPOINTS = {
	root: respondToPing,
	'health-check': checkCryptoApiStatus,
	changelog: getChangelog,
	'get-configuration': getConfigurationResponse,
	'list-available-crypto': getAvailableCrypto,

	// update config commands
	pause: updateUserConfig,
	unpause: updateUserConfig,
	'set-buy-percentage': updateUserConfig,
	'set-sell-percentage': updateUserConfig,
	'force-sell': updateUserConfig,
	'change-crypto': updateUserConfig,
	'set-sell-warning': updateUserConfig,
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

		// USER_NAME = BODY.member.user.username;
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

		return errorResponse('Invalid request signature', 500);
	}

};


/**
 * Returns the user database configuration as formatted JSON
 */
async function getConfigurationResponse() {
	const config = await getUserConfiguration(ID);
	return JSON.stringify(config, null, 4);
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


/**
 * Get the users database configuration, update field(s) based on the input command
 * Update configuration in the database and respond with a message
 */
async function updateUserConfig() {

	let responseMsg;
	let percentage;

	// validate commands that require input params before continuing
	if (COMMAND === 'set-buy-percentage') {
		percentage = getInputParam('percentage');

		if (!percentage || percentage >= 0) {
			return `Invalid input (${percentage}) - must be a negative number`;
		}
	}

	if (COMMAND === 'set-sell-percentage') {
		percentage = getInputParam('percentage');

		if (!percentage || percentage <= 0) {
			return `Invalid input (${percentage}) - must be a positive number`;
		}
	}

	if (COMMAND === 'set-sell-warning') {
		percentage = getInputParam('percentage');

		if (!percentage || percentage >= 0) {
			return `Invalid input (${percentage}) - must be a negative number`;
		}
	}

	// only load config if the above validation was successful
	const config = await getUserConfiguration(ID);

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
		responseMsg = `Your buy percentage is now **${percentage}%** of the last sell price`;
	}

	if (COMMAND === 'set-sell-percentage') {
		config.sellPercentage = percentage;
		responseMsg = `Your sell percentage is now **+${percentage}%** of the last buy price`;
	}

	if (COMMAND === 'set-sell-warning') {
		config.alertPercentage = percentage;
		responseMsg = `Your warning percentage is set to notify you when the value is **${percentage}%** of the last purchase price`;
	}

	if (COMMAND === 'force-sell') {
		config.forceSell = true;
		responseMsg = `All **${config.currenciesTargeted[0]}** will be sold by the crypto-bot shortly!\nOnce sold the bot will be paused`;
	}

	if (COMMAND === 'change-crypto') {

		const inputCrypto = getInputParam('currency-code');

		if (!inputCrypto) {
			return 'No crypto currency provided';
		}

		const availableCrypto = await getAvailableCrypto(true);

		const newCrypto = inputCrypto.toUpperCase();

		if (availableCrypto.find(c => c === newCrypto)) {
			config.currenciesTargeted = [newCrypto];
			responseMsg = `Your crypto-bot will now look at **${newCrypto}**, it will buy in at the market price`;
		} else {
			return `'**${newCrypto}**' is either an invalid name or is not available through the crypto.com exchange`;
		}
	}

	await updateInvestmentConfig(config);

	return responseMsg;
}
