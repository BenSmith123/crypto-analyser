
const axios = require('axios');
const { writeFileSync } = require('fs');

const { DISCORD_ENABLED, DISCORD_URL_ALERTS, DISCORD_URL_LOGS } = require('./environment');

const { version } = require('../package.json');

const decimalValueMap = require('./data/decimalValueMap.json');


const calculatePercDiff = (a, b) => 100 * ((a - b) / ((a + b) / 2));


/**
 * Returns the rounded down floating point of a crypto based on the number
 * of decimal values that the crypto can be traded at
 *
 * @param {number} num
 * @param {string} cryptoName
 * @returns {number}
 */
function round(num, cryptoName) {
	const dp = getTradeDecimalValue(cryptoName);
	const wholeNumDigits = Math.floor(num).toString().length;
	return parseFloat(num.toString().substring(0, dp + wholeNumDigits + 1)); // +1 for the decimal
}


/**
 * Returns the max amount of decimal places that a given crypto can be traded at
 *
 * @param {string} cryptoName
 * @returns {number}
 */
function getTradeDecimalValue(cryptoName) {
	return decimalValueMap.find(crypto => crypto.base_currency === cryptoName).quantity_decimals;
}


/**
 * @param {object} data
 * @param {string=} fileName - optional
 */
const saveJsonFile = (data, fileName) => {
	writeFileSync(fileName || 'z-temp.json', JSON.stringify(data, null, 4));
};


/**
 * @param {string} name - crypto currency name
 * @param {string} context - 'brought' or 'sold'
 * @param {number} price
 * @param {number} value
 * @param {number} diff
 * @returns {string}
 */
function formatPriceLog(name, context, price, value, diff) {

	const sym = diff > 0
		? '+'
		: '';

	return `${name} was last ${context} at ${price} and is now ${value} (${sym}${diff.toFixed(2)}%)`;
}


/**
 * @param {string} type - buy or sell
 * @param {string} cryptoName
 * @param {number} amount
 * @param {number} value - value of the crypto
 * @returns {object}
 */
function formatOrder(type, cryptoName, amount, value) {

	const isBuy = type === 'buy';

	return {
		type: type.toUpperCase(),
		name: cryptoName,
		amount,
		value,
		estimate: isBuy
			? `${amount / value} ${cryptoName}`
			: `${(amount * value).toFixed(2)} USD`,
		summary: isBuy
			? `Buy order placed for $${amount} USD worth of ${cryptoName} coins at ${value}`
			: `Sell order placed for ${amount} ${cryptoName} coins at $${value} USD`,
		date: new Date().toLocaleString(),
	};
}


/**
 * Sends a POST request message to discord
 *
 * @param {string|object} message
 * @param {boolean} [isAlert=false] - optional: log to #alerts instead of #logs channel
 * @param {boolean} [username] - optional: override the default bot name - used in discord-api
 */
async function logToDiscord(message, isAlert = false, username) {

	if (!DISCORD_ENABLED) { return null; }

	if (!message) { throw new Error('No message content'); }

	const url = isAlert
		? DISCORD_URL_ALERTS
		: DISCORD_URL_LOGS;

	const data = {
		username: username || `Analyser v${version}`,
		content: message,
	};

	if (typeof message !== 'string') { data.content = JSON.stringify(message, null, 4); }

	if (isAlert) { console.log(data.content); } // console log any alerts

	const params = {
		url,
		method: 'POST',
		data,
		headers: {
			'Content-Type': 'application/json',
		},
	};

	try {
		return await axios(params);
	} catch (err) {
		// suppress error
		console.log('Error sending message to discord: ', err);
		return err;
	}
}


module.exports = {
	calculatePercDiff,
	round,
	saveJsonFile,
	formatPriceLog,
	formatOrder,
	logToDiscord,
};
