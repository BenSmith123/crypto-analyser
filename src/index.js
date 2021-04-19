
const axios = require('axios');
const crypto = require('crypto-js');
const { DynamoDB } = require('aws-sdk');
require('dotenv').config();


const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });
const DATABASE_TABLE = 'CRYPTO_TRANSACTIONS_TEST';

const { API_KEY, API_SECRET } = process.env;


const API_URL = process.env.NODE_ENV === '!test'
	? 'https://uat-api.3ona.co/v2/'
	: 'https://api.crypto.com/v2/';

const SELL_PERCENTAGE = 5;


// maker 0.10% (staking 5000 discount 0.090%)
// taker 0.16% (staking 5000 discount 0.144%)


// MAIN FUNCTION
(async () => {

	/**
	* TODO
	*
	* - Load database config, validate key/values
	*     - Store logs in memory and write them all out to database or S3 on lambda termination
	* - Check last purchase time & number of purchases - don't buy/sell too often
	* - Check if there are already outstanding buy/sell orders?
	* - Market OR limit buying/selling? - note market buy/sell is usually instant, safer/easier?
	*/

	try {

		const investmentState = await loadInvestmentState();

		validateInvestmentData(investmentState);

		const tickerEndpoint = 'public/get-ticker?instrument_name=BTC_USDC'; // get coin value
		const instrumentsEndpoint = 'public/get-instruments';
		const getCandlestick = 'public/get-candlestick?instrument_name=BTC_USDT&timeframe=1D';

		const a = await sellCryptoExample();
		console.log(a);

		const res = await axios(API_URL + tickerEndpoint);

		const cryptoData = res.data.result.data;

		// map API response to meanings
		const PRICE = {
			bestBid: 'b',
			bestAsk: 'k',
			latestTrade: 'a',
		};

		if (investmentState.action === 'BUY') {

			const lastSellPrice = 70567.101; // 57736.719;
			const cryptoValue = cryptoData[PRICE.bestAsk];

			const percentageDiff = calculateDiffPerc(lastSellPrice, cryptoValue);

			console.log(percentageDiff);

			// if best ask price is X percent less than the sell price, BUY!
			if (percentageDiff > SELL_PERCENTAGE) {
				// TODO - buy!
				console.log('BUY!');

			}

			console.log('SELL!');

		} else {
			// sell
			console.log(cryptoData[PRICE.bestBid]);

			// TODO - if best bid price is X percent higher than our last buy price, SELL!
		}

		// console.log(res.data);

	} catch (err) {
		console.log(err.response.data);
	}

})();


const calculateDiffPerc = (a, b) => 100 * ((a - b) / ((a + b) / 2));


/**
 * Returns the investment state from the database
 */
async function loadInvestmentState() {

	// const params = {
	// 	TableName: DATABASE_TABLE,
	// 	Key: {
	// 		id: 'configuration',
	// 	},
	// };

	// const a = await dynamoClient.get(params).promise();
	// console.log(a.Item);


	// TODO - replace with database call
	// - move the databaseInvestmentTemplate out of src so its not deployed to lambda
	return require('./databaseInvestmentTemplate.json'); // eslint-disable-line
}


function validateInvestmentData() {
	// TODO - validate the database data & structure
	return true;
}


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


async function examplePostRequest() {

	const request = {
		id: 11,
		method: 'private/get-account-summary',
		api_key: API_KEY,
		params: {
			// currency: 'CRO',
		},
		nonce: Date.now(),
	};

	const requestBody = JSON.stringify(signRequest(request, API_KEY, API_SECRET));

	const res = await axios({
		url: `${API_URL}private/get-account-summary`,
		method: 'post',
		data: requestBody,
		headers: {
			'content-type': 'application/json',
		},
	});

	return res.data;
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

	const requestBody = JSON.stringify(signRequest(request, API_KEY, API_SECRET));

	const res = await axios({
		url: `${API_URL}private/get-account-summary`,
		method: 'post',
		data: requestBody,
		headers: {
			'content-type': 'application/json',
		},
	});

	return res.data;
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

	const requestBody = JSON.stringify(signRequest(request, API_KEY, API_SECRET));

	const res = await axios({
		url: `${API_URL}private/create-order`,
		method: 'post',
		data: requestBody,
		headers: {
			'content-type': 'application/json',
		},
	});

	return res.data;
}
