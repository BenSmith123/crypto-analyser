
const axios = require('axios');
const crypto = require('crypto-js');

const { timeout, logToDiscord } = require('./helpers');
const { API_URL, API_KEY, API_SECRET, TRANSACTIONS_ENABLED, USER_ID } = require('./environment');
const { saveTransaction } = require('./database');

const API_ENDPOINTS = {
	getTicker: 'public/get-ticker',
	getInstruments: 'public/get-instruments',
	getCandlestick: 'public/get-candlestick',
	// private endpoints (post requests)
	getAccountSummary: 'private/get-account-summary',
	createOrder: 'private/create-order',
	getOrderHistory: 'private/get-order-history',
	getOrderDetail: 'private/get-order-detail',
};


function signRequest(request, apiKey, apiSecret) {

	const { id, method, params, nonce } = request;

	const paramsString = params == null
		? ''
		: Object.keys(params)
			.sort()
			.reduce((a, b) => a + b + params[b], '');

	const sigPayload = method + id + apiKey + paramsString + nonce;

	request.sig = crypto
		.HmacSHA256(sigPayload, apiSecret)
		.toString(crypto.enc.Hex);

	return request;
}


// returns true if array values are increasing or the same
function isIncreasing(elt, i, arr) {
	const prev = arr[i - 1]
		? arr[i - 1].c
		: 0;
	return !i || elt.c === prev || elt.c > prev;
}


// returns true if array values are decreasing or the same
function isDecreasing(elt, i, arr) {
	const prev = arr[i - 1]
		? arr[i - 1].c
		: 0;
	return !i || elt.c === prev || elt.c > prev;
}


/**
 * Signs the request with the API keys - returns the Crypto.com API response
 *
 * @param {string} apiEndpoint
 * @param {object} requestBody
 */
async function postToCryptoApi(requestBody) {

	if (!requestBody || !requestBody.method) { throw new Error('Missing request body or request method'); }

	// TEMP attempt to catch mysterious error
	try {
		const res = await axios({
			url: API_URL + requestBody.method,
			method: 'post',
			data: JSON.stringify(signRequest(requestBody, API_KEY, API_SECRET)),
			headers: {
				'content-type': 'application/json',
			},
		});

		return res.data;

	} catch (err) {

		// TODO - should this be removed now?
		const errorDetails = {
			requestBody,
			message: err.message,
			stack: err.stack,
		};

		await logToDiscord(errorDetails, true);
		throw err;
	}
}


/**
 * Returns the crypto API values of a crypto currency
 *
 * @param {string} instrumentName - crypto and currency of the coin
 */
async function getCryptoValue(instrumentName) {

	if (!instrumentName) { throw new Error('No instrument name provided'); }

	const tickerEndpoint = `${API_ENDPOINTS.getTicker}?instrument_name=${instrumentName}`;

	const res = await axios(API_URL + tickerEndpoint);

	return res.data.result;
}


/**
 * Returns the crypto API account summary
 *
 * @param {string} [currency] - optional (default will return all crypto)
 * @returns {object} - structured object by currency name e.g. { CRO: { balance: 0 } }
 */
async function getAccountSummary(currency) {

	const request = {
		id: 10000,
		method: API_ENDPOINTS.getAccountSummary,
		api_key: API_KEY,
		params: currency
			? { currency }
			: {}, // API requires empty params when none are needed
		nonce: Date.now(),
	};

	const response = await postToCryptoApi(request);

	const accountSummary = response.result.accounts
		.filter(account => account.available > 0) // filter out accounts that have no crypto balance
		.reduce((acc, curr) => ( // eslint-disable-line no-return-assign
			acc[curr.currency] = { ...curr }, acc), // eslint-disable-line no-sequences
		{});

	if (!accountSummary || !Object.keys(accountSummary).length) {
		throw new Error('No accounts returned');
	}

	return accountSummary;
}


/**
 * Returns the crypto API account summary
 *
 * @param {string} currency - optional (default will return all crypto)
 * @returns {object} - structured object by currency name e.g. { CRO: { balance: 0 } }
 */
async function getOrderHistory() {

	const request = {
		id: 11,
		method: API_ENDPOINTS.getOrderHistory,
		api_key: API_KEY,
		params: {
			instrument_name: 'DOGE_USDT',
			// start_ts: 1587846300000,
			// end_ts: 1587846358253,
			page_size: 20,
			page: 0,
		},
		nonce: Date.now(),
	};

	const response = await postToCryptoApi(request);

	return response;
}


/**
 * Returns the crypto API account summary
 *
 * @param {string} orderId
 * @returns {object}
 */
async function getOrderDetail(orderId) {

	const request = {
		id: 11,
		method: API_ENDPOINTS.getOrderDetail,
		api_key: API_KEY,
		params: {
			order_id: orderId,
		},
		nonce: Date.now(),
	};

	const response = await postToCryptoApi(request);

	return response;
}


/**
 * Gets the specified order that was placed. If the order placed was filled,
 *     save the transaction to the database and return the price the order was placed at
 * Otherwise,
 *     try again (with another 1sec delay)
 *     if order is still not filled, store in database anyway,
 *     return null
 *
 * TODO
 *
 * @param {string} orderId
 * @param {boolean} [attempt] - don't repeat if on second attempt
 * @returns {object|null}
 */
async function processPlacedOrder(orderId, attempt = 0) {

	if (!TRANSACTIONS_ENABLED) { return null; }

	if (!orderId) {
		logToDiscord('No order number provided', true);
		return null;
	}

	await timeout(attempt ? 100 : 500);

	const order = await getOrderDetail(orderId);

	const orderIsFilled = order.result?.order_info?.status === 'FILLED' || false;

	if (orderIsFilled) {
		await saveTransaction(order.result);
		return order.result.order_info.avg_price;
	}

	// if not first attempt
	if (attempt) {

		// after first attempt try one more time
		if (attempt === 1) {
			return processPlacedOrder(orderId, 2);
		}

		if (!order || !order.result || !Object.keys(order.result).length) {
			logToDiscord(`Order placed but was not found [order ID: ${orderId}]\nTransaction not saved`, true);
			return null;
		}

		await saveTransaction(order.result);
		logToDiscord(`Order was placed but not filled - no confirmed value [order ID: ${orderId}]`, true);
		return null;
	}

	return processPlacedOrder(orderId, 1);
}


/**
 * Returns an object with simplified currency values by currency name
 *
 * @param {array<string>} currenciesTargeted - list of currencies to get the value of e.g. ['CRO', ]
 * @returns {object}
 * @example { CRO: { bestBid: 0.159, bestAsk: 0.15916, latestTrade: 0.15916 }, ... }
 */
async function getAllCryptoValues(currenciesTargeted) {

	const cryptoPricesPromiseArr = [];

	for (let i = 0; i < currenciesTargeted.length; i++) {
		const currentCryptoName = currenciesTargeted[i];

		if (currentCryptoName !== 'USDT') { // USDT shouldn't be listed in currenciesTargeted
			cryptoPricesPromiseArr.push(getCryptoValue(`${currentCryptoName}_USDT`));
		}
	}

	// get the current price in USDT value of each currency
	const currValuesRaw = await Promise.all(cryptoPricesPromiseArr);

	// eslint-disable-next-line no-return-assign
	return currValuesRaw.reduce((currValuesFormatted, valueRaw) => (
		// split key name by _ (e.g. CRO_USDT becomes CRO)
		currValuesFormatted[valueRaw.instrument_name.split('_')[0]] = { // eslint-disable-line
			bestBid: valueRaw.data.b,
			bestAsk: valueRaw.data.k,
			latestTrade: valueRaw.data.a,
		}, currValuesFormatted), // eslint-disable-line no-sequences
	{});
}


/**
 * Returns the crypto API candlestick data of a crypto currency
 *
 * @param {string} instrumentName - crypto and currency of the coin
 */
async function getCryptoCandlestick(instrumentName, timeframe) {

	if (!instrumentName) { throw new Error('No instrument name provided'); }

	const tickerEndpoint = `${API_ENDPOINTS.getCandlestick}?instrument_name=${instrumentName}&timeframe=${timeframe}`;

	const res = await axios(API_URL + tickerEndpoint);

	return res.data.result;
}


/**
 * Gets the crypto API candlestick data and returns true if the crypto currency latest OPEN value
 * is still increasing/descreasing. If any data is missing then log warning and default return false
 *
 * @param {string} cryptoName
 * @param {boolean} [checkIncrease=true] - check for increase or decrease trend
 */
async function checkLatestValueTrend(cryptoName, checkIncrease = true) {

	// compare last 3 intervals of 5mins
	const timeframe = '5m';
	const lookback = -3; // num of array elements to compare

	const candlestick = await getCryptoCandlestick(`${cryptoName}_USDT`, timeframe);

	if (!candlestick.data || !candlestick.data.length) { throw new Error(`Missing candlestick data for ${cryptoName}`); }

	const latest = candlestick.data.slice(lookback);

	return checkIncrease
		? latest.every(isIncreasing)
		: latest.every(isDecreasing);
}


/**
 * Places a market buy order, returns crypto API response
 *
 * @param {string} cryptoName
 * @param {number} amount
 */
async function placeBuyOrder(cryptoName, amount) {

	if (!TRANSACTIONS_ENABLED) { return null; }

	const request = {
		id: 11,
		method: API_ENDPOINTS.createOrder,
		api_key: API_KEY,
		params: {
			instrument_name: `${cryptoName}_USDT`, // buy {crypto} with USDT
			side: 'BUY',
			type: 'MARKET',
			notional: amount, // amount of USDT
			client_oid: USER_ID, // optional client order ID
		},
		nonce: Date.now(),
	};

	return postToCryptoApi(request);
}


/**
 * Places a market buy order, returns crypto API response
 *
 * @param {string} cryptoName
 * @param {number} amount
 */
async function placeSellOrder(cryptoName, amount) {

	if (!TRANSACTIONS_ENABLED) { return null; }

	const request = {
		id: 11,
		method: API_ENDPOINTS.createOrder,
		api_key: API_KEY,
		params: {
			instrument_name: `${cryptoName}_USDT`, // sell {crypto} for USDT
			side: 'SELL',
			type: 'MARKET',
			quantity: amount, // amount of {crypto}
			client_oid: USER_ID, // optional client order ID
		},
		nonce: Date.now(),
	};

	return postToCryptoApi(request);
}


module.exports = {
	getAccountSummary,
	getOrderHistory,
	getOrderDetail,
	processPlacedOrder,
	// getCryptoValue, - export if needed
	getAllCryptoValues,
	// getCryptoCandlestick, - export if needed
	checkLatestValueTrend,
	placeBuyOrder,
	placeSellOrder,
};
