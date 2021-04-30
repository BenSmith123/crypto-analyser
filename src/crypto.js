
const axios = require('axios');
const crypto = require('crypto-js');

const { API_URL, API_KEY, API_SECRET } = require('./environment');

const API_ENDPOINTS = {
	getTicker: 'public/get-ticker?instrument_name=CRO_USDT',
	getInstruments: 'public/get-instruments',
	getCandlestick: 'public/get-candlestick?instrument_name=BTC_USDT&timeframe=1h',
	getAccountSummary: 'private/get-account-summary',
	createOrder: 'private/create-order',
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

	const tickerEndpoint = `${API_ENDPOINTS.getTicker}?instrument_name=${instrumentName}`;
	// TODO - any use case for getting all crypto values? (remove the instrument_name param)

	const res = await axios(API_URL + tickerEndpoint);

	return res.data.result;
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
		method: API_ENDPOINTS.getAccountSummary,
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
			acc[curr.currency] = { ...curr }, acc), // eslint-disable-line no-sequences
		{});
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


async function placeBuyOrder() {

	const request = {
		id: 11,
		method: API_ENDPOINTS.createOrder,
		api_key: API_KEY,
		params: {
			instrument_name: 'CRO_USDT', // buy {crypto} with USDT
			side: 'BUY',
			type: 'MARKET',
			notional: 1, // amount of USDT
			client_oid: 'my_ordtfg', // optional client order ID
		},
		nonce: Date.now(),
	};

	return postToCryptoApi(request);
}


async function placeSellOrder() {

	const request = {
		id: 11,
		method: API_ENDPOINTS.createOrder,
		api_key: API_KEY,
		params: {
			instrument_name: 'CRO_USDT', // sell {crypto} for USDT
			side: 'SELL',
			type: 'MARKET',
			quantity: 5, // amount of {crypto}
			client_oid: 'my_order00234', // optional client order ID
		},
		nonce: Date.now(),
	};

	return postToCryptoApi(request);
}


module.exports = {
	getAccountSummary,
	// getCryptoValue, - export if needed
	getAllCryptoValues,
	placeBuyOrder,
	placeSellOrder,
};
