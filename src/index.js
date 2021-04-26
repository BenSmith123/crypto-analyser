
const { DynamoDB } = require('aws-sdk');

const { INTERNAL_RUN } = require('./environment');
const { calculatePercDiff, saveJsonFile, postToDiscord } = require('./helpers');
const { getAccountSummary, getAllCryptoValues } = require('./crypto');

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });
const DATABASE_TABLE = 'CRYPTO_TRANSACTIONS_TEST';

// TODO - configurable via database
const BUY_PERCENTAGE = 5;
const SELL_PERCENTAGE = 5;

// const BUY_PERCENTAGE_DECIMAL = BUY_PERCENTAGE / 100;
// const SELL_PERCENTAGE_DECIMAL = SELL_PERCENTAGE / 100;


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

		if (investmentState.isPaused) {
			postToDiscord(actionToTake); // TODO - message
			return actionToTake;
		}

		const accountSummary = await getAccountSummary();

		if (!accountSummary || !Object.keys(accountSummary).length) {
			throw new Error('No accounts returned');
		}

		// can try buy if there is USDT funds
		let canBuy = accountSummary.USDT.available > 0;

		// can try sell if there are any cryptos that aren't just USDT
		const canSell = Object.keys(accountSummary).length > 1 || !accountSummary.USDT;

		if (!canBuy && !canSell) {
			// TODO - STALE END - log to discord, end lambda function
		}

		// get crypto value of each crypto targetted
		const cryptoValues = await getAllCryptoValues(investmentState.currenciesTargeted);
		const cryptoValueNames = Object.keys(cryptoValues);

		for (let i = 0; i < cryptoValueNames.length; i++) {
			const currCryptoName = cryptoValueNames[i];
			const currCryptoValue = cryptoValues[currCryptoName];

			// database transaction record of the crypto
			const cryptoRecord = investmentState.transactionsLatest[currCryptoName];

			// if there is no buy or sell record of the crypto
			if (!cryptoRecord) {
				// TODO - place order @ market price!
				canBuy = false; // order placed, make no more
				continue;
			}

			if (!cryptoRecord.lastSellPrice && !cryptoRecord.lastBuyPrice) {
				// TODO - post to discord an error:
				// Crypto currency record has no last sell or last buy price
				continue;
			}

			// check for BUY condition
			if (cryptoRecord.lastSellPrice) {
				// if previously brought, buy back in if price is < x percent less than last sell price

				const percentageDiff = calculatePercDiff(currCryptoValue.bestAsk, cryptoRecord.lastSellPrice);

				if (percentageDiff < SELL_PERCENTAGE) { // crypto is down more than x %
					// TODO - buy back in!
					canBuy = false;
					continue;
				}
			}

			// check for SELL condition
			const percentageDiff = calculatePercDiff(currCryptoValue.bestBid, cryptoRecord.lastBuyPrice);

			if (percentageDiff > BUY_PERCENTAGE) { // crypto is up more than x %
				// TODO - get more details of the crypto and see if it has gone down in the last x minutes
				// TODO - place sell order!
				continue;
			}

		}

	} catch (err) {
		// TODO:
		// update database config:
		// investmentState.isPaused = true;
		// upload config to database
		// post to discord
		// end lambda

		console.log(err);
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
