
/**
 * Seperate lambda function that uses the same helper functions as the crypto-analyser projects
 * This is set up through API gateway and can be invoked by URL or by discord commands
 *
 * API endpoint: https://csezryhvsa.execute-api.ap-southeast-2.amazonaws.com/prod
 */

require('dotenv').config();
const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const moment = require('moment-timezone');

const { respondToPing, errorResponse, requestIsValid, getCommandDetails, validateCommandParams, getUserConfiguration } = require('./discord-helpers');
const { getCommands, getChangelog, checkCryptoApiStatus, getAvailableCrypto } = require('./slash-commands');
const { DATETIME_FORMAT } = require('../environment');
const { updateInvestmentConfig } = require('../database');
const helpers = require('../helpers');

const discordName = 'Crypto assistant';


// map discord command paths to their functions
// if function is not defined, use updateConfiguration
const API_ENDPOINTS = {
	test,
	changelog: getChangelog,
	commands: getCommands,
	'get-configuration': getConfigurationResponse,
	'health-check': checkCryptoApiStatus,
	'list-available-crypto': getAvailableCrypto,
};


exports.discordController = async function (event) {

	try {

		if (!requestIsValid(event)) {
			return errorResponse(`Invalid request: ${JSON.stringify(event)}`, 401);
		}

		const body = JSON.parse(event.body) || null;

		const command = body?.data?.name;

		// no command specified, respond to discord service
		if (!command) {
			return respondToPing();
		}

		// simplify data
		const requestData = {
			userId: body.member.user.id,
			command,
			body,
		};

		// if command is mapped to a function, run it - otherwise its a user config update
		const content = await API_ENDPOINTS[command](requestData) || await updateUserConfig(requestData); // eslint-disable-line

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
async function getConfigurationResponse({ userId }) {
	const config = await getUserConfiguration(userId);

	// TODO - filter out data - format too?

	return JSON.stringify(config, null, 4);
}


/**
 * Get the users database configuration, update field(s) based on the input command
 * Update configuration in the database and respond with a message
 */
async function updateUserConfig({ command, userId, body }) {

	let responseMsg;
	let percentage;

	const commandDetails = getCommandDetails(command);

	if (!commandDetails) {
		return `Command '${command}' not found`;
	}

	// validate the command and their input parameter values
	const paramErrors = validateCommandParams(body, commandDetails);

	if (paramErrors.length) {
		return paramErrors.join('\n');
	}

	const config = await getUserConfiguration(userId);

	if (command === 'pause') {
		config.isPaused = true;
		responseMsg = 'Your crypto-bot is now **paused**';
	}

	if (command === 'unpause') {
		config.isPaused = false;
		responseMsg = 'Your crypto-bot is now **unpaused**';
	}

	if (command === 'toggle-log-format') {
		config.options.simpleLogs = !config.options.simpleLogs;
		responseMsg = config.options.simpleLogs
			? 'Short logs enabled'
			: 'Short logs disabled';
	}

	if (command === 'set-buy-percentage') {
		config.buyPercentage = percentage;
		responseMsg = `Your buy percentage is now **${percentage}%** of the last sell price`;
	}

	if (command === 'set-sell-percentage') {
		config.sellPercentage = percentage;
		responseMsg = `Your sell percentage is now **+${percentage}%** of the last buy price`;
	}

	if (command === 'set-sell-warning') {
		config.alertPercentage = percentage;
		responseMsg = `Your warning percentage is set to notify you when the value is **${percentage}%** of the last purchase price`;
	}

	if (command === 'set-hard-sell-low') {
		config.hardSellPercentage.low = percentage;
		responseMsg = `Your hard-sell LOW percentage is now **${percentage}%** of the last buy price`;
	}

	if (command === 'set-hard-sell-high') {
		config.hardSellPercentage.high = percentage;
		responseMsg = `Your hard-sell HIGH percentage is now **+${percentage}%** of the last buy price`;
	}

	if (command === 'force-buy') {
		config.forceBuy = true;
		responseMsg = `All **${config.currenciesTargeted[0]}** will be brought by the crypto-bot shortly!`;
	}

	if (command === 'force-sell') {
		config.forceSell = true;
		responseMsg = `All **${config.currenciesTargeted[0]}** will be sold by the crypto-bot shortly!\nOnce sold the bot will be paused`;
	}

	if (command === 'change-crypto') {

		const inputCrypto = getInputValue('currency-code');

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
