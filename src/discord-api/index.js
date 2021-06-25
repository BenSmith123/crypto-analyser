
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

const multipleCurrencyLimit = 8;

const BYPASS_VALIDATION = process.env.BYPASS_VALIDATION === 'true';


// map discord command paths to their functions
// if function is not defined, use updateConfiguration
const API_ENDPOINTS = {
	test,
	changelog: getChangelog,
	commands: getCommands,
	health: checkCryptoApiStatus,
	configuration: getConfigurationResponse,
	'list-available-crypto': getAvailableCrypto,
	// NOTE - these are all read only endpoints, this is exposed to the web-API also
	// don't add any functions that have a perform write operations
};


// manual CORS check
function isPublicHttpRequest(headers) { return headers?.origin?.includes('cryptobot.nz'); }


exports.discordController = async function (event) {

	if (isPublicHttpRequest(event.headers)) { return publicHttpController(event); }

	// if not public http request, assume discord and validate discord headers
	try {

		if (!requestIsValid(event) && !BYPASS_VALIDATION) {
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
			body: body.data,
		};

		// if command is mapped to a function, run it - otherwise its a user config update
		const content = API_ENDPOINTS[command]
			? await API_ENDPOINTS[command](requestData)
			: await updateUserConfig(requestData);

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
		await logToDiscord(`An unexpected error has occurred: ${err.message}\nStack: ${err.stack}\nEvent: ${event.body}\nDate: ${moment(Date.now()).format(DATETIME_FORMAT)}`);

		return errorResponse('Invalid request signature', 500);
	}

};


/**
 * Returns the HTTP response based on the requested API endpoint
 *
 * @param {object} event
 * @returns {object}
 */
async function publicHttpController(event) {

	const requestedEndpoint = event.pathParameters.endpoint;

	if (event.httpMethod !== 'GET' && event.httpMethod !== 'OPTIONS') { return returnHttpError(400, 'Invalid request method'); }
	if (!API_ENDPOINTS[requestedEndpoint]) { throw new Error(404, 'Endpoint not found'); }

	const response = await API_ENDPOINTS[requestedEndpoint]({ json: true });

	return {
		statusCode: 200,
		body: response,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	};
}


/**
 * @param {number} statusCode - default 400
 * @param {string} body - JSON
 * @returns {object}
 */
function returnHttpError(statusCode = 400, body) {
	return {
		statusCode: statusCode || 400,
		body,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	};
}


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

	const filteredConfig = {
		ID: config.id,
		currencies: config.currenciesTargeted,
		isPaused: config.isPaused,
		records: config.records,
		options: config.options,
	};

	return JSON.stringify(filteredConfig, null, 4).replace(/"|,/g, '');
}


/**
 * Get the users database configuration, update field(s) based on the input command
 * Update configuration in the database and respond with a message
 *
 * @returns {string}
 */
async function updateUserConfig({ command, userId, body }) {

	let responseMsg;

	const commandDetails = getCommandDetails(command);

	if (!commandDetails) {
		return `Command '${command}' not found`;
	}

	// validate the command and their input parameter values
	const paramErrors = validateCommandParams(body, commandDetails);

	if (paramErrors.length) {
		return paramErrors.join('\n');
	}

	const options = {};

	// get simplified object of the params & values e.g. { name: 'ben' }
	body.options?.forEach(option => {
		options[option.name] = option.value;
	});

	const config = await getUserConfiguration(userId);

	const currencyCode = options.code?.toUpperCase();
	const currentRecord = config.records[currencyCode];

	switch (command) {

	case 'pause': {
		config.isPaused = true;
		responseMsg = 'Your crypto-bot is now **paused**';
		break;
	}

	case 'unpause': {
		config.isPaused = false;
		responseMsg = 'Your crypto-bot is now **unpaused**';
		break;
	}

	case 'toggle-log-format': {
		config.options.simpleLogs = !config.options.simpleLogs;
		responseMsg = config.options.simpleLogs
			? 'Short logs enabled'
			: 'Short logs disabled';
		break;
	}

	case 'add-crypto': {

		if (Object.keys(config.records).length === multipleCurrencyLimit) {
			responseMsg = 'Max number of currencies reached';
			break;
		}

		const currencyExists = config.currenciesTargeted.find(c => c === currencyCode);

		if (currencyExists) { return `'${currencyCode}' already exists in your configuration`; }

		config.currenciesTargeted.push(currencyCode);
		config.records[currencyCode] = {
			...options['limit-amount'] && {
				limitUSDT: options['limit-amount'],
			},
			thresholds: {
				sellPercentage: options['sell-percentage'],
				buyPercentage: options['buy-percentage'],
				warningPercentage: options['warning-percentage'],
				stopLossPercentage: options['stop-loss-percentage'],
			},
		};

		responseMsg = `Your crypto-bot will now look at **${currencyCode}**, it will buy shortly at the market price`;
		break;
	}

	case 'remove-crypto': {

		const currencyExists = config.currenciesTargeted.find(c => c === currencyCode);

		if (!currencyExists) { return `'${currencyCode}' does not exist in your configuration`; }
		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		config.currenciesTargeted = config.currenciesTargeted.filter(c => c !== currencyCode);
		delete config.records[currencyCode];
		responseMsg = `Your crypto-bot will no longer monitor **${currencyCode}**`;
		break;
	}

	case 'force-buy': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }
		if (currentRecord.isHolding) { return `You are already holding **${currencyCode}**`; }

		currentRecord.forceBuy = true;
		delete currentRecord.isAtLoss; // if in stop-loss scenario and forceBuy was used
		// remove this flag to avoid buying back in incorrectly

		responseMsg = `**${currencyCode}** will be bought by the crypto-bot shortly!`;
		break;
	}

	case 'force-sell': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }
		if (!currentRecord.isHolding) { return `You aren't holding any **${currencyCode}**`; }

		currentRecord.forceSell = true;
		delete currentRecord.isAtLoss;
		responseMsg = `**${currencyCode}** will be sold by the crypto-bot shortly!`;
		break;
	}

	case 'set-buy-threshold': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.buyPercentage = options['buy-percentage'];
		responseMsg = `Your buy threshold is now **${options['buy-percentage']}%** of the last sell price`;
		break;
	}

	case 'set-sell-threshold': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.sellPercentage = options['sell-percentage'];
		responseMsg = `Your sell percentage is now **+${options['sell-percentage']}%** of the last purchase price`;
		break;
	}

	case 'set-sell-warning': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.warningPercentage = options['warning-percentage'];
		responseMsg = `Your crypto-bot is set to notify you when the value is **${options['warning-percentage']}%** of the last purchase price`;
		break;
	}

	case 'set-stop-loss': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.stopLossPercentage = options['stop-loss-percentage'];
		responseMsg = `Your **${currencyCode}** stop loss percentage is now **${options['stop-loss-percentage']}%** of the last buy price`;
		break;
	}

	case 'set-limit': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.limitUSDT = options['limit-amount'];
		responseMsg = `**${currencyCode}** will now trade with a maximum of $${currentRecord.limitUSDT} USDT\nThis limit will be updated automatically after sell transactions to include any gains/losses when trading`;
		break;
	}

	default:
		return `/${command} not found`;
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
