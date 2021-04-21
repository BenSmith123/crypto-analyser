
const axios = require('axios');
const crypto = require('crypto-js');

const { API_URL, API_KEY, API_SECRET } = require('./environment');


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
 * Returns the crypto API account summary
 *
 * @param {string} currency - optional (default will return all crypto)
 * @returns {object}
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

	// TODO - return a better structure if we already know the desired currency
	// i.e. account[currency].available would be easier than account.find(...)

	return currency
		// return accounts that have a crypto balance if all currencies were returned
		? response.result.accounts.filter(account => account.available > 0)
		: response.result.accounts;
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
	getAccountSummary,
};
