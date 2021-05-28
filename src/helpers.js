
const axios = require('axios');
const moment = require('moment-timezone');

const { writeFileSync } = require('fs');

const { DISCORD_ENABLED, DISCORD_URL_ALERTS, DISCORD_URL_LOGS, DATETIME_FORMAT } = require('./environment');

const { version } = require('../package.json');

const decimalValueMap = require('./data/decimalValueMap.json');

moment.tz.setDefault('Pacific/Auckland');


const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

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
 * @param {string} context - 'bought' or 'sold'
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
 * @param {number} amount - crypto that was bought or USDT that was sold for a crypto
 * @param {number} valuePlaced - crypto value that the order was PLACED at
 * @param {number} [valueFilled] - optional - crypto value that the order was FILLED at
 * @returns {object}
 */
function formatOrder(type, cryptoName, amount, valuePlaced, valueFilled) {

	const isBuy = type === 'buy';

	// declare/default values as if the order was not filled
	let value = valuePlaced;
	let status = 'PLACED';
	let estimateFlag = 'Estimate';

	if (valueFilled) {
		value = valueFilled;
		status = 'FILLED';
		estimateFlag = '';
	}

	return {
		type: type.toUpperCase(),
		name: cryptoName,
		amount,
		valuePlaced,
		valueFilled,
		quantity: isBuy
			? `${estimateFlag} ${amount / value} ${cryptoName}`
			: `${estimateFlag} ${(amount * value).toFixed(2)} USD`,
		summary: isBuy
			? `Buy order ${status} for $${amount} USD worth of ${cryptoName} coins at ${value}`
			: `Sell order ${status} for ${amount} ${cryptoName} coins at $${value} USD`,
		date: moment(Date.now()).format(DATETIME_FORMAT),
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

	if (typeof message !== 'string') {
		data.content = JSON.stringify(message, null, 4).replace(/"/g, '');
	}

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
	timeout,
	calculatePercDiff,
	round,
	saveJsonFile,
	formatPriceLog,
	formatOrder,
	logToDiscord,
};
