
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

const multipleCurrencyLimit = 4;


// map discord command paths to their functions
// if function is not defined, use updateConfiguration
const API_ENDPOINTS = {
	test,
	changelog: getChangelog,
	commands: getCommands,
	configuration: getConfigurationResponse,
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
		await logToDiscord(`An unexpected error has occurred: ${err.message}
		\nStack: ${err.stack}
		\nEvent: ${JSON.stringify(event)}
		\nDate: ${moment(Date.now()).format(DATETIME_FORMAT)}`);

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

	const filteredConfig = {
		ID: config.id,
		currencies: config.currenciesTargeted,
		isPaused: config.isPaused,
		records: config.records,
		options: config.options,
	};

	return JSON.stringify(filteredConfig, null, 4).replace(/"/g, '');
}


/**
 * Get the users database configuration, update field(s) based on the input command
 * Update configuration in the database and respond with a message
 *
 * @returns {string}
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

	const options = {};

	// get simplified object of the params & values e.g. { name: 'ben' }
	body?.options.forEach(option => {
		options[option.name] = option.value;
	});

	const config = await getUserConfiguration(userId);

	const currencyCode = options.code.toUpperCase();
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
				alertPercentage: options['warning-percentage'], // TODO - rename 'alertPercentage'
				hardSellPercentage: {
					high: null,
					low: options['stop-loss-percentage'], // TODO - remove/fix data
				},
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

		currentRecord.forceBuy = true;
		responseMsg = `**${currencyCode}** will be bought by the crypto-bot shortly!`;
		break;
	}

	case 'force-sell': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.forceSell = true;
		responseMsg = `**${currencyCode}** will be sold by the crypto-bot shortly!\nOnce sold the bot will be paused`;
		break;
	}

	case 'set-buy-threshold': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.buyPercentage = options['buy-percentage'];
		responseMsg = `Your buy threshold is now **${percentage}%** of the last sell price`;
		break;
	}

	case 'set-sell-threshold': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.sellPercentage = options['sell-percentage'];
		responseMsg = `Your sell percentage is now **+${percentage}%** of the last purchase price`;
		break;
	}

	case 'set-sell-warning': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.alertPercentage = options['warning-percentage'];
		responseMsg = `Your crypto-bot is set to notify you when the value is **${percentage}%** of the last purchase price`;
		break;
	}

	case 'set-stop-loss': {

		if (!currentRecord) { return `Your crypto-bot isn't using **${currencyCode}**`; }

		currentRecord.thresholds.hardSellPercentage.low = options['sell-percentage'];
		responseMsg = `Your stop loss percentage is now **${percentage}%** of the last buy price`;
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
