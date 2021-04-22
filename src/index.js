
const { DynamoDB } = require('aws-sdk');

const { INTERNAL_RUN } = require('./environment');
const { calculateDiffPerc, saveJsonFile, postToDiscord } = require('./helpers');
let { getCryptoValue, getAccountSummary } = require('./crypto');

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });
const DATABASE_TABLE = 'CRYPTO_TRANSACTIONS_TEST';

// TODO - configurable via database
const BUY_PERCENTAGE = 5;
const SELL_PERCENTAGE = 5;

const BUY_PERCENTAGE_DECIMAL = BUY_PERCENTAGE / 100;
const SELL_PERCENTAGE_DECIMAL = SELL_PERCENTAGE / 100;


// map API response to meanings
const PRICE = {
	bestBid: 'b',
	bestAsk: 'k',
	latestTrade: 'a',
};

const ACTIONS = {
	DO_NOTHING: 'DO_NOTHING',
	BUY: 'BUY',
	SELL: 'SELL',
};


/**
 * TODO
 *
 * - Load database config, validate key/values
 *     - Store logs in memory and write them all out to database or S3 on lambda termination
 * - Check last purchase time & number of purchases - don't buy/sell too often
 * - Check if there are already outstanding buy/sell orders?
 * - Market OR limit buying/selling? - note market buy/sell is usually instant, safer/easier?
 */


/**
 * Lambda handler function!
 *
 * @param {object} event - AWS Lambda function event
 * @param {object} [mockFunctions=null] - optional, used for debugging/analysis in INTERNAL_RUN mode
 * @returns
 */
exports.main = async function (event, mockFunctions = null) { // eslint-disable-line func-names

	// Scheduled job (CloudWatch)
	if (!isScheduledEvent(event)) {

		// TODO - implement API gateway and create API functions!
		// if (event.pathParameters && event.pathParameters.endpoint)

		// terminate the lambda function if it wasn't invoked by a scheduled job (CloudWatch)
		return 'Nothing to see here :)';
	}


	if (INTERNAL_RUN) {
		// replace the functions that get external data with mock functions
		if (!mockFunctions) { throw new Error('INTERNAL_RUN mode is true but no mock functions passed in'); }

		getAccountSummary = mockFunctions.getAccountSummary();
		loadInvestmentState = mockFunctions.loadInvestmentState(); // eslint-disable-line no-func-assign
	}

	try {

		// TODO
		// - get database investment state
		// - API call - get the current price of whatever crypto I'm buying/selling
		// - get account details from API
		//     - compare details with database state? - see if orders have gone through?
		//     - compare avail balance with database state & what API says my balance is
		//     - check time of last buy/sell order? - could limit no. of orders per day or whatever

		const investmentState = await loadInvestmentState();
		validateInvestmentData(investmentState);

		const actionToTake = {
			action: ACTIONS.DO_NOTHING,
			details: 'Investment state action is paused',
		};

		if (investmentState.action === 'PAUSED') {
			postToDiscord();
			return actionToTake;
		}

		const accountSummary = await getAccountSummary();

		if (!accountSummary || Object.keys(accountSummary).length) {
			throw new Error('No accounts returned');
		}

		if (accountSummary.USDT.available > 0) {
			// TODO - money available, try buy!

			// loop through the database listed crypto currencies
			// compare the brought price of the crypto in the database
			// with the accountSummary crypto, if up X percent buy!

			for (let i = 0; i < accountSummary.currenciesTargeted.length; i++) {
				const currentCryptoName = accountSummary.currenciesTargeted[i];

				const cryptoPrices = await getCryptoValue(`${currentCryptoName}_USDT`);

			}

		}


		// const shouldBuy = investmentState.action === 'BUY';

		const currencyString = shouldBuy // TODO - configurable via db config
			? 'CRO_USDT'
			: 'USDT_CRO';

		const cryptoPrices = await getCryptoValue(currencyString);

		if (shouldBuy && investmentState.firstTimeBuy) {

			// buy @ market price?
			investmentState.firstTimeBuy = false;
			investmentState.latest.targetSellPrice = cryptoData[PRICE.bestAsk] * (1 + SELL_PERCENTAGE_DECIMAL);

			// TODO - update database config, post to discord

			// actionToTake.action = 'BUY';
			// actionToTake.details = 'Buy at market price';

			return actionToTake;
		}


		const cryptoPrice = shouldBuy
			? cryptoPrices[PRICE.bestAsk]
			: cryptoPrices[PRICE.bestBid];

		const buyPrice = cryptoPrice * (1 + BUY_PERCENTAGE_DECIMAL);
		const sellPrice = cryptoPrice * (1 - SELL_PERCENTAGE_DECIMAL);

		const percentageDiff = calculateDiffPerc(targetPrice, cryptoPrice);

		if (shouldBuy) {
			if (cryptoPrice < targetPrice) {
				// BUY
			}

			if (cryptoPrice > targetPrice) {
				// sell
			}
		}

		// if (shouldPlaceOrder(shouldBuy, cryptoPrice, targetPrice)) {
		// 	// TODO
		// }

		// if best ask price is X percent less than the sell price, BUY!
		if (percentageDiff > SELL_PERCENTAGE) {

			// TODO - how to avoid early before a big spike?
			// maybe look at smaller intervals of the crypto price and if its incrementing
			// high percentages then don't buy yet - NOTE: consider the lambda function invocation cycle

			// TODO - buy!
			console.log('BUY!');

		}


	} catch (err) {
		// TODO - in this generic error scenario should the
		// database config 'action' be updated to 'PAUSED'?

		console.log(err.response.data);
	}

};


const isScheduledEvent = event => event['detail-type'] && event['detail-type'] === 'Scheduled Event';


/**
 * Returns the investment state from the database
 */
async function loadInvestmentState() {

	// const params = {
	// TableName: DATABASE_TABLE,
	// Key: {
	// id: 'configuration',
	// },
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
 * @param {boolean} isBuyOrder
 * @param {number} cryptoPrice
 * @returns {boolean}
 */
function shouldPlaceOrder(isBuyOrder, cryptoPrice) {

	const percentageDiff = calculateDiffPerc(lastSellPrice, cryptoPrice);


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
