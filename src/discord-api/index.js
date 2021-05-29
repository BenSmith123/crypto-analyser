
/**
 * Seperate lambda function that uses the same helper functions as the crypto-analyser projects
 * This is set up through API gateway and can be invoked by URL or by discord commands
 *
 * API endpoint: https://csezryhvsa.execute-api.ap-southeast-2.amazonaws.com/prod
 *
 * Commands:
 *    /changelog
 *    /change-crypto
 *    /commands
 *    /force-sell
 *    /force-buy
 *    /get-configuration
 *    /health-check
 *    /help - TODO
 *    /list-available-crypto
 *    /pause
 *    /set-buy-percentage
 *    /set-hard-sell-low
 *    /set-hard-sell-high
 *    /set-sell-percentage
 *    /set-sell-warning
 *    /test
 *    /toggle-log-format
 *    /unpause
 */

require('dotenv').config();
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const moment = require('moment-timezone');

const { respondToPing, errorResponse, requestIsValid, getUserConfiguration } = require('./discord-helpers');
const { getCommands, getChangelog, checkCryptoApiStatus, getAvailableCrypto } = require('./slash-commands');
const { DATETIME_FORMAT } = require('../environment');
const { updateInvestmentConfig } = require('../database');
const helpers = require('../helpers');


const discordName = 'Crypto assistant';


// map discord command paths to their functions
const API_ENDPOINTS = {

	root: respondToPing,

	test,

	changelog: getChangelog,
	commands: getCommands,

	'get-configuration': getConfigurationResponse,
	'health-check': checkCryptoApiStatus,
	'list-available-crypto': getAvailableCrypto,

	// update config commands
	pause: updateUserConfig,
	unpause: updateUserConfig,
	'force-buy': updateUserConfig,
	'force-sell': updateUserConfig,
	'change-crypto': updateUserConfig,
	'set-buy-percentage': updateUserConfig,
	'set-hard-sell-low': updateUserConfig,
	'set-hard-sell-high': updateUserConfig,
	'set-sell-percentage': updateUserConfig,
	'set-sell-warning': updateUserConfig,
	'toggle-log-format': updateUserConfig,
};


// globals
let COMMAND;
let USER_NAME;
let ID;
let BODY;


exports.discordController = async function (event) {

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
		await logToDiscord(`An unexpected error has occurred: ${err.message}\n\nStack: ${err.stack}\n\nEvent: ${JSON.stringify(event)} \n\nDate: ${moment(Date.now()).format(DATETIME_FORMAT)}`);

		return errorResponse('Invalid request signature', 500);
	}

};


/**
 * Interface to ensure all discord logs are always alerts and sent with the discord name
 *
 * @param {string} msg
 */
async function logToDiscord(msg) {
	await helpers.logToDiscord(msg, true, discordName);
}


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
	if (COMMAND === 'set-buy-percentage'
		|| COMMAND === 'set-sell-warning'
		|| COMMAND === 'set-hard-sell-low') {

		percentage = getInputParam('percentage');

		if (!percentage || percentage >= 0) {
			return `Invalid input (${percentage}) - must be a negative number`;
		}
	}

	if (COMMAND === 'set-sell-percentage' || COMMAND === 'set-hard-sell-high') {
		percentage = getInputParam('percentage');

		if (!percentage || percentage <= 0) {
			return `Invalid input (${percentage}) - must be a positive number`;
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

	if (COMMAND === 'toggle-log-format') {
		config.options.simpleLogs = !config.options.simpleLogs;
		responseMsg = config.options.simpleLogs
			? 'Short logs enabled'
			: 'Short logs disabled';
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

	if (COMMAND === 'set-hard-sell-low') {
		config.hardSellPercentage.low = percentage;
		responseMsg = `Your hard-sell LOW percentage is now **${percentage}%** of the last buy price`;
	}

	if (COMMAND === 'set-hard-sell-high') {
		config.hardSellPercentage.high = percentage;
		responseMsg = `Your hard-sell HIGH percentage is now **+${percentage}%** of the last buy price`;
	}

	if (COMMAND === 'force-buy') {
		config.forceBuy = true;
		responseMsg = `All **${config.currenciesTargeted[0]}** will be brought by the crypto-bot shortly!`;
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


async function test() {

	const lambda = new AWS.Lambda({ region: 'ap-southeast-2' });

	const params = {
		FunctionName: 'crypto-analyser',
		Payload: JSON.stringify({ hello: 'ben' }),
	};

	lambda.invoke(params, async (err, data) => {
		if (err) {
			console.log(err, err.stack); // an error occurred
			await logToDiscord(err.message || 'hello');

			return err.message;
		}
		console.log(data);
		await logToDiscord(data || 'hello');
		return data || 'hello';
	});
}
