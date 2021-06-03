
const nacl = require('tweetnacl');

const { loadInvestmentConfig } = require('../database');

const discordCommandsData = require('../data/discordCommands.json');
const decimalValueMap = require('../data/decimalValueMap.json');


function errorResponse(err, statusCode = 400) {
	return {
		statusCode,
		body: err.message || err,
	};
}


function respondToPing() {
	return {
		statusCode: 200,
		body: JSON.stringify({
			type: 4,
			data: {
				content: JSON.stringify({ type: 1 }),
			},
		}),
	};
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
 * Returns the input parameter of the discord slash command if it exists
 *
 * @param {string} paramName - name of the slash command parameter
 * @param {object} inputOptions
 */
function getInputValue(paramName, inputOptions) {
	if (!inputOptions) return null;

	const param = inputOptions.find(option => (option.name === paramName));

	return param?.value || null;
}


/**
 * @param {string} commandName
 */
function getCommandDetails(commandName) {
	return discordCommandsData.commands.find(c => c.name === commandName);
}


/**
 * Returns an array of errors based on the given parameter options and the
 * command parameter details specified in the discordCommands.json
 *
 * NOTE - this does NOT validate the logic of the command, just the params/values
 *
 * @param {object} body - body of the incoming request
 * @param {object} commandDetails
 * @returns {array}
 */
function validateCommandParams(body, commandDetails) {

	if (!commandDetails.options || !commandDetails.options.length) {
		return []; // no options specified in the commands to validate
	}

	const inputOptions = body?.options;

	if (!inputOptions) {
		return ['Internal error - options were specified in commands list but don\'t exist on the request'];
	}

	const validationErrors = inputOptions.map(option => {

		const isRequired = commandDetails.options.find(opt => (opt.name === option.name)).required;

		const optionValue = getInputValue(option.name, inputOptions);

		// skip validation if it isn't required and wasn't provided
		if (isRequired === false || !optionValue) {
			return null;
		}

		switch (option.name) {

		case 'code': {
			const foundCurrency = decimalValueMap
				.find(crypto => crypto.base_currency === optionValue.toUpperCase());

			return foundCurrency
				? null
				: `'**${optionValue}**' is invalid or is not available through the crypto.com exchange - use /list-available-crypto for the full list`;
		}

		case 'sell-percentage': {
			return optionValue > 0
				? null
				: `Invalid input '${optionValue}' - ${option.name} must be a positive number`;
		}

		case 'buy-percentage' || 'stop-loss-percentage' || 'warning-percentage': {
			return optionValue < 0
				? null
				: `Invalid input '${optionValue}' - ${option.name} must be a negative number`;
		}

		case 'limit-amount': {
			return optionValue >= 1
				? null
				: `Invalid input '${optionValue}' - ${option.name} must be at least $1 USDT`;
		}

		default: {
			return `Internal error - '${option.name}' was sent on the request but has no validation`;
		}

		}
	});

	return validationErrors.filter(Boolean);
}


/**
 * Returns the user database configuration
 *
 * @param {string} userId
 * @returns {object}
 */
async function getUserConfiguration(userId) {

	if (!userId) { throw new Error(`User does not exist: ID=${userId}`); }

	return loadInvestmentConfig(userId);
}


module.exports = {
	errorResponse,
	respondToPing,
	requestIsValid,
	getInputValue,
	getCommandDetails,
	validateCommandParams,
	getUserConfiguration,
};
