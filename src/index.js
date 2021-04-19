
const axios = require('axios');
const { DynamoDB } = require('aws-sdk');

const { calculateDiffPerc, saveJsonFile } = require('./helpers');
const { getAccountSummary } = require('./crypto');

require('dotenv').config();

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });
const DATABASE_TABLE = 'CRYPTO_TRANSACTIONS_TEST';


const SELL_PERCENTAGE = 5;
const SELL_PERCENTAGE_DECIMAL = SELL_PERCENTAGE / 100;


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

		// const accountSummary = await getAccountSummary();
		// saveJsonFile(accountSummary, 'account-summary1');


		const tickerEndpoint = 'public/get-ticker?instrument_name=CRO_USDT'; // get coin value
		const instrumentsEndpoint = 'public/get-instruments';
		const getCandlestick = 'public/get-candlestick?instrument_name=BTC_USDT&timeframe=1h';

		const res = await axios(`https://api.crypto.com/v2/${getCandlestick}`);

		const cryptoData = res.data.result.data;

		// map API response to meanings
		const PRICE = {
			bestBid: 'b',
			bestAsk: 'k',
			latestTrade: 'a',
		};


		if (investmentState.action === 'BUY') {

			if (investmentState.firstTimeBuy) {
				// buy @ market price?

				investmentState.firstTimeBuy = false;
				investmentState.latest.targetSellPrice = cryptoData[PRICE.bestAsk] * (1 + SELL_PERCENTAGE_DECIMAL);

				// TODO - update database config
				return;
			}

			const lastSellPrice = 70567.101; // 57736.719;
			const cryptoValue = cryptoData[PRICE.bestAsk];

			const percentageDiff = calculateDiffPerc(lastSellPrice, cryptoValue);

			console.log(percentageDiff);

			// if best ask price is X percent less than the sell price, BUY!
			if (percentageDiff > SELL_PERCENTAGE) {

				// TODO - how to avoid early before a big spike?
				// maybe look at smaller intervals of the crypto price and if its incrementing
				// high percentages then don't buy yet - NOTE: consider the lambda function invocation cycle

				// TODO - buy!
				console.log('BUY!');

			}

		} else {
			// sell
			console.log(cryptoData[PRICE.bestBid]);

			// TODO - if best bid price is X percent higher than our last buy price, SELL!
		}

		// console.log(res.data);

	} catch (err) {

		// TODO - in this generic error scenario should the database config 'action' be updated to 'PAUSED'?

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

	// TODO return false if data.action = 'PAUSED'
	// in error scenarios that might need looking at manually, stop further trading
	return true;
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

