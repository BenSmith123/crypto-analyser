
const { INTERNAL_RUN } = require('./environment');
const { validateInvestmentConfig } = require('./database');
let { loadInvestmentConfig, updateInvestmentConfig } = require('./database');
let { getAccountSummary, getAllCryptoValues } = require('./crypto');
const { calculatePercDiff, postToDiscord } = require('./helpers');


/**
 * TODO
 *
 * - Load database config, validate key/values
 *     - Store logs in memory and write them all out to database or S3 on lambda termination
 * - Check last purchase time & number of purchases - don't buy/sell too often
 * - Check if there are already outstanding buy/sell orders?
 * - Market OR limit buying/selling? - note market buy/sell is usually instant, safer/easier?
 * - AUDITER lambda to watch orders placed and update database config
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
		loadInvestmentConfig = mockFunctions.loadInvestmentState();
		updateInvestmentConfig = mockFunctions.updateInvestmentConfig();
		getAllCryptoValues = mockFunctions.getAllCryptoValues();
	}

	try {
		const results = await makeCryptoCurrenciesTrades();

		return results;

	} catch (err) {
		// TODO:
		// update database config:
		// investmentState.isPaused = true;
		// upload config to database
		// post to discord
		// end lambda

		// updateInvestmentConfig();

		console.log(err);
		return 'TODO - error message'; // TODO
	}

};


// main function for handling the buying/selling of the crypto currencies
async function makeCryptoCurrenciesTrades() {

	const investmentConfig = await loadInvestmentConfig();
	validateInvestmentConfig(investmentConfig);

	if (investmentConfig.isPaused) {
		postToDiscord('ERROR! AHH'); // TODO - message
		return;
	}

	// TODO - wrap this in a try/catch and retry on error?
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
		return;
	}

	// get crypto value of each crypto targetted
	const cryptoValues = await getAllCryptoValues(investmentConfig.currenciesTargeted);
	const cryptoValueNames = Object.keys(cryptoValues);

	for (let i = 0; i < cryptoValueNames.length; i++) {
		const cryptoName = cryptoValueNames[i];
		const cryptoValue = cryptoValues[cryptoName];

		// database transaction record of the crypto
		const cryptoRecord = investmentConfig.transactions[cryptoName];

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

			const percentageDiff = calculatePercDiff(cryptoValue.bestAsk, cryptoRecord.lastSellPrice);

			if (percentageDiff < investmentConfig.sellPercentage) { // crypto is down more than x %
				// TODO - buy back in!

				// update transaction record of the current
				investmentConfig.transactions[cryptoValue] = {
					lastBuyPrice: cryptoValue.bestAsk,
					orderPlaced: new Date(),
				};

				updateInvestmentConfig(investmentConfig);

				canBuy = false;
				continue;
			}
		}

		// check for SELL condition
		const percentageDiff = calculatePercDiff(cryptoValue.bestBid, cryptoRecord.lastBuyPrice);

		if (percentageDiff > investmentConfig.buyPercentage) { // crypto is up more than x %
			// TODO - get more details of the crypto and see if it has gone down in the last x minutes
			// TODO - place sell order!
			continue;
		}

	}
}


const isScheduledEvent = event => event['detail-type'] && event['detail-type'] === 'Scheduled Event';
