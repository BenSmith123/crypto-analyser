
const axios = require('axios');
const { DynamoDB } = require('aws-sdk');

const { calculateDiffPerc, saveJsonFile, signRequest } = require('./helpers');

require('dotenv').config();

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });
const DATABASE_TABLE = 'CRYPTO_TRANSACTIONS_TEST';

const { API_KEY, API_SECRET } = process.env;

const API_URL = process.env.NODE_ENV === '!test'
	? 'https://uat-api.3ona.co/v2/'
	: 'https://api.crypto.com/v2/';

const SELL_PERCENTAGE = 5;


/**
 * TODO
 *
 * - Load database config, validate key/values
 *     - Store logs in memory and write them all out to database or S3 on lambda termination
 * - Check last purchase time & number of purchases - don't buy/sell too often
 * - Check if there are already outstanding buy/sell orders?
 * - Market OR limit buying/selling? - note market buy/sell is usually instant, safer/easier?
 */

exports.main = async function (event) { // eslint-disable-line func-names

	// Scheduled job (CloudWatch)
	if (!isScheduledEvent(event)) {

		// TODO - implement API gateway and create API functions!
		// if (event.pathParameters && event.pathParameters.endpoint)

		// terminate the lambda function if it wasn't invoked by a scheduled job (CloudWatch)
		return 'Nothing to see here :)';
	}

	try {

		const investmentState = await loadInvestmentState();

		validateInvestmentData(investmentState);

		const a = require('../z-temp.json');

		const accountSummary = await getAccountSummary();

		saveJsonFile(accountSummary, 'account-summary1');


		const tickerEndpoint = 'public/get-ticker?instrument_name=CRO_USDT'; // get coin value
		const instrumentsEndpoint = 'public/get-instruments';
		const getCandlestick = 'public/get-candlestick?instrument_name=BTC_USDT&timeframe=1D';

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

};


const isScheduledEvent = event => event['detail-type'] && event['detail-type'] === 'Scheduled Event';


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
	// i.e. account[currency].balance would be easier than account.find(...)

	return currency
		// return accounts that have a crypto balance if all currencies were returned
		? response.result.accounts.filter(account => account.balance > 0)
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
 * Saves a transaction to the database
 */
async function saveTransaction(transaction) {

	if (!transaction.id) { throw new Error('Missing transaction id'); }

	const params = {
		TableName: DATABASE_TABLE,
		Item: transaction,
	};

	const a = await dynamoClient.put(params).promise();
	return a;
}

