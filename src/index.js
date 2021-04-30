
const { INTERNAL_RUN } = require('./environment');
const { validateInvestmentConfig, updateTransactions } = require('./database');
let { loadInvestmentConfig, updateInvestmentConfig } = require('./database');
let { getAccountSummary, getAllCryptoValues, placeBuyOrder, placeSellOrder } = require('./crypto');
const { calculatePercDiff, logToDiscord } = require('./helpers');


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

		loadInvestmentConfig = mockFunctions.loadInvestmentConfig;
		getAccountSummary = mockFunctions.getAccountSummary;
		updateInvestmentConfig = mockFunctions.updateInvestmentConfig;
		getAllCryptoValues = mockFunctions.getAllCryptoValues;
		placeBuyOrder = () => {}; // TODO - replace with mock
		placeSellOrder = () => {}; // TODO - replace with mock
	}

	let investmentConfig;


	try {
		investmentConfig = await loadInvestmentConfig();
		validateInvestmentConfig(investmentConfig);

		if (investmentConfig.isPaused) {
			// don't send as alert since whatever caused the pause would have done that already
			await logToDiscord('Paused - no action taken');
			return; // end lambda // TODO - return data
		}

	} catch (err) {
		// log error and end lambda (without updating to a paused state)
		// await log to ensure lambda doesn't terminate before log is properly sent
		await logToDiscord(`An error occurred loading/validating database config: ${err.message}\n\nStack: ${err.stack}`, true);
		return; // end lambda // TODO - return data
	}


	try {
		const results = await makeCryptoCurrenciesTrades(investmentConfig);

		return results;

	} catch (err) {
		// generic unexpected error scenario - log, update database config to paused, end lambda

		await logToDiscord(`An unexpected error has occurred: ${err.message}\n\nStack: ${err.stack}`, true);

		investmentConfig.isPaused = true;
		await updateInvestmentConfig(investmentConfig);

		return ''; // TODO
	}

};


// main function for handling the buying/selling of the crypto currencies
async function makeCryptoCurrenciesTrades(investmentConfig) {

	// TODO - wrap this in a try/catch and retry on error?
	const accountSummary = await getAccountSummary();

	if (!accountSummary || !Object.keys(accountSummary).length) {
		throw new Error('No accounts returned');
	}

	// can try buy if there is USDT funds
	let canBuy = (accountSummary.USDT && accountSummary.USDT.available > 0) || false;

	// can try sell if there are any cryptos that aren't just USDT
	const canSell = Object.keys(accountSummary).length > 1 || !accountSummary.USDT;

	let orderPlaced = false;
	let result; // TEMP - used for local-analyse

	// get crypto value of each crypto targetted
	const cryptoValues = await getAllCryptoValues(investmentConfig.currenciesTargeted);
	const cryptoValueNames = Object.keys(cryptoValues);

	for (let i = 0; i < cryptoValueNames.length; i++) {

		if (!canBuy && !canSell) {
			// no more actions to take, log to discord and return
			logToDiscord('Paused - no action taken'); // TODO - just log later
			break;
		}

		const cryptoName = cryptoValueNames[i];
		const cryptoValue = cryptoValues[cryptoName];

		// database transaction record of the crypto
		const cryptoRecord = investmentConfig.transactions[cryptoName];

		// if there is no buy or sell record of the crypto
		if (!cryptoRecord) {
			// TODO - place order @ market price!

			investmentConfig = updateTransactions(investmentConfig, cryptoName, cryptoValue, true);

			result = 'buy';
			orderPlaced = true;
			canBuy = false; // order placed, make no more
			continue;
		}

		if (!cryptoRecord.lastSellPrice && !cryptoRecord.lastBuyPrice) {
			// if price then log and skip to the next crypto
			logToDiscord(`${cryptoName} database record has no last sell or last buy price`, true);
			continue;
		}

		// check for BUY condition
		if (cryptoRecord.lastSellPrice) {
			// if previously brought, buy back in if price is < x percent less than last sell price

			const percentageDiff = calculatePercDiff(cryptoValue.bestAsk, cryptoRecord.lastSellPrice);
			console.log(`value has changed: ${percentageDiff}`);

			if (percentageDiff < investmentConfig.buyPercentage) { // crypto is down more than x %
				// TODO - buy back in!

				investmentConfig = updateTransactions(investmentConfig, cryptoName, cryptoValue, true);

				result = 'buy';
				orderPlaced = true;
				canBuy = false;
				continue;
			}
		}

		// check for SELL condition
		const percentageDiff = calculatePercDiff(cryptoValue.bestBid, cryptoRecord.lastBuyPrice);
		console.log(`value has changed: ${percentageDiff}`);

		if (percentageDiff > investmentConfig.sellPercentage) { // crypto is up more than x %
			// TODO - get more details of the crypto and see if it has gone down in the last x minutes
			// TODO - place sell order!

			investmentConfig = updateTransactions(investmentConfig, cryptoName, cryptoValue, false);
			result = 'sell';
			orderPlaced = true;
			continue;
		}

	}

	// after going through all crypto, if any orders were made, update the database config
	if (orderPlaced) {
		await updateInvestmentConfig(investmentConfig);

		return result;
	}
}


const isScheduledEvent = event => event['detail-type'] && event['detail-type'] === 'Scheduled Event';
