
const axios = require('axios');
const crypto = require('crypto-js');

const { API_URL, API_KEY, API_SECRET } = require('./environment');

// const API_ENDPOINTS = {
// 	getTicker: 'public/get-ticker?instrument_name=CRO_USDT',
// const instrumentsEndpoint = 'public/get-instruments';
// const getCandlestick = 'public/get-candlestick?instrument_name=BTC_USDT&timeframe=1h';
// };


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


/**
 * Signs the request with the API keys - returns the Crypto.com API response
 *
 * @param {string} apiEndpoint
 * @param {object} requestBody
 */
async function postToCryptoApi(requestBody) {

	if (!requestBody || !requestBody.method) { throw new Error('Missing request body or request method'); }

	const res = await axios({
		url: API_URL + requestBody.method,
		method: 'post',
		data: JSON.stringify(signRequest(requestBody, API_KEY, API_SECRET)),
		headers: {
			'content-type': 'application/json',
		},
	});

	return res.data;
}


/**
 * Returns the crypto API values of a crypto currency
 *
 * @param {string} instrumentName - crypto and currency of the coin
 */
async function getCryptoValue(instrumentName) {

	if (!instrumentName) { throw new Error('No instrument name provided'); }

	const tickerEndpoint = `public/get-ticker?instrument_name=${instrumentName}`;
	// TODO - any use case for getting all crypto values? (remove the instrument_name param)

	const res = await axios(API_URL + tickerEndpoint);

	return res.data.result.data;
}


/**
 * Returns the crypto API account summary
 *
 * @param {string} currency - optional (default will return all crypto)
 * @returns {object} - structured object by currency name e.g. { CRO: { balance: 0 } }
 */
async function getAccountSummary(currency) {

	const request = {
		id: 11,
		method: 'private/get-account-summary',
		api_key: API_KEY,
		params: currency
			? { currency }
			: {}, // API requires empty params when none are needed
		nonce: Date.now(),
	};

	const response = await postToCryptoApi(request);

	return response.result.accounts
		.filter(account => account.available > 0) // filter out accounts that have no crypto balance
		.reduce((acc, curr) => ( // eslint-disable-line no-return-assign
			acc[curr.currency] = { ...curr }, acc),
		{});
}


// THIS ISN'T WORKING ATM!
async function buyCryptoExample() {

	const request = {
		id: 11,
		method: 'private/create-order',
		params: {
			instrument_name: 'CRO_USDT',
			side: 'BUY',
			type: 'MARKET',
			notional: 10, // amount to spend
			client_oid: 'my_order00234', // optional client order ID
		},
		nonce: Date.now(),
	};

	return postToCryptoApi(request);
}


async function sellCryptoExample() {

	const request = {
		id: 11,
		method: 'private/create-order',
		api_key: API_KEY,
		params: {
			instrument_name: 'CRO_USDT',
			side: 'SELL',
			type: 'MARKET',
			quantity: 5,
			// client_oid: 'my_order00234', // optional client order ID
		},
		nonce: Date.now(),
	};

	return postToCryptoApi(request);
}


module.exports = {
	getCryptoValue,
	getAccountSummary,
};
