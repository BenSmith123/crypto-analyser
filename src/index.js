
const { INTERNAL_RUN } = require('./environment');
const { investmentConfigIsValid, updateTransactions } = require('./database');
let { loadInvestmentConfig, updateInvestmentConfig } = require('./database');
let { getAccountSummary, getOrderDetail, getAllCryptoValues, checkLatestValueTrend, placeBuyOrder, placeSellOrder } = require('./crypto');
const { calculatePercDiff, round, formatOrder, formatPriceLog, logToDiscord } = require('./helpers');
const { log, getLogs } = require('./logging');


/**
 * Lambda handler function!
 *
 * @param {object} event - AWS Lambda function event
 * @param {object} [mockFunctions=null] - optional, used for debugging/analysis in INTERNAL_RUN mode
 * @returns
 */
exports.main = async function (event, mockFunctions = null) {

	// const a = await getOrderDetail();
	// console.log(a);

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
		checkLatestValueTrend = () => false;
	}

	const investmentConfig = await loadInvestmentConfig();

	if (!investmentConfigIsValid(investmentConfig)) {
		// log error and end lambda (without updating to a paused state)
		await logToDiscord(`An error occurred validating database config: \n\nConfig: ${JSON.stringify(investmentConfig)}`, true);
		return []; // end lambda
	}

	if (investmentConfig.isPaused) {
		// don't send as alert since whatever caused the pause would have done that already
		await logToDiscord('Paused - no action taken');
		return []; // end lambda
	}

	try {

		const accountSummary = await getAccountSummary();

		if (!accountSummary || !Object.keys(accountSummary).length) {
			throw new Error('No accounts returned');
		}

		const results = await makeCryptoCurrenciesTrades(investmentConfig, accountSummary);

		// log account details every 12pm
		const d = new Date();
		if (d.getHours() === 12 && d.getMinutes() === 0) {
			log(`Account summary: \n${JSON.stringify(accountSummary, null, 4)}`);
		}

		// if any orders were made, update the database config and send transaction logs
		if (results.ordersPlaced.length) {
			await updateInvestmentConfig(results.config);
			await logToDiscord(
				results.ordersPlaced.length === 1
					? results.ordersPlaced[0]
					: results.ordersPlaced,
				true,
			);
		}

		return results.ordersPlaced || [];

	} catch (err) {

		// generic unexpected error scenario - log, update database config to paused, end lambda

		// await log to ensure lambda doesn't terminate before log is properly sent
		await logToDiscord(`An unexpected error has occurred: ${err.message}\n\nDate: ${new Date().toLocaleString()}\n\nStack: ${err.stack}`, true);

		investmentConfig.isPaused = true;
		await updateInvestmentConfig(investmentConfig);

		return err; // end lambda

	} finally {

		// send the runtime logs to discord
		const runtimeLogs = getLogs();

		if (runtimeLogs.length) {
			await logToDiscord(runtimeLogs.join('\n'));
		}
	}

};


// main function for handling the buying/selling of the crypto currencies
async function makeCryptoCurrenciesTrades(investmentConfig, account) {

	let config = investmentConfig;

	// can try buy if there is USDT funds - $1 or more
	let canBuy = (account.USDT && account.USDT.available >= 1) || false;

	// can try sell if there are any cryptos that aren't just USDT
	const canSell = Object.keys(account).length > 1 || !account.USDT;

	// store amount of USDT available if it exists
	const availableUSDT = canBuy
		? Math.floor(account.USDT.available) // ignore fractions of cents
		: 0;

	const ordersPlaced = [];

	// get crypto value of each crypto targetted
	const cryptoValues = await getAllCryptoValues(config.currenciesTargeted);
	const cryptoValueNames = Object.keys(cryptoValues);

	for (let i = 0; i < cryptoValueNames.length; i++) {

		if (!canBuy && !canSell) {
			// no more actions to take, log to discord and return
			logToDiscord('No funds or crypto currencies to trade', true);
			break;
		}

		const cryptoName = cryptoValueNames[i];
		const cryptoValue = cryptoValues[cryptoName];

		// database transaction record of the crypto
		const cryptoRecord = config.transactions[cryptoName];

		// if there is no buy or sell record of the crypto
		if (!cryptoRecord) {

			if (!canBuy) { continue; }

			// TODO - stack to promises.all?
			const order = await placeBuyOrder(cryptoName, availableUSDT);

			config = updateTransactions(config, cryptoName, cryptoValue, true);

			const orderDetails = formatOrder('buy', cryptoName, availableUSDT, cryptoValue.bestAsk);
			log(orderDetails.summary);

			ordersPlaced.push(orderDetails);

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

			log(formatPriceLog(cryptoName, 'sold', cryptoRecord.lastSellPrice, cryptoValue.bestAsk, percentageDiff));

			if (percentageDiff < -config.buyPercentage) { // crypto is down more than x %

				if (await checkLatestValueTrend(cryptoName, false)) {
					// if the crypto value is still decreasing, hold off buying!
					log(`${cryptoName} is still decreasing, holding off buying..`);
					continue;
				}

				// TODO - stack promises.all?
				const order = await placeBuyOrder(cryptoName, availableUSDT);

				config = updateTransactions(config, cryptoName, cryptoValue, true);

				const orderDetails = formatOrder('buy', cryptoName, availableUSDT, cryptoValue.bestAsk);
				log(orderDetails.summary);

				ordersPlaced.push(orderDetails);

				canBuy = false;
			}

			continue;
		}

		// check for SELL condition
		const percentageDiff = calculatePercDiff(cryptoValue.bestBid, cryptoRecord.lastBuyPrice);

		log(formatPriceLog(cryptoName, 'brought', cryptoRecord.lastBuyPrice, cryptoValue.bestBid, percentageDiff));

		// crypto is up more than x %
		if (percentageDiff > config.sellPercentage || config.forceSell) {

			if (await checkLatestValueTrend(cryptoName, true)) {
				// if the crypto value is still increasing, hold the crypto!
				log(`${cryptoName} is still increasing, holding off selling..`);
				continue;
			}

			// otherwise, crypto value is up but not consistently, sell!
			const availableCrypto = round(account[cryptoName].available, cryptoName);

			const order = await placeSellOrder(cryptoName, availableCrypto); // TODO - stack promises.all?

			config = updateTransactions(config, cryptoName, cryptoValue, false);

			if (config.forceSell) { config.forceSell = false; }

			const orderDetails = formatOrder('Sell', cryptoName, availableCrypto, cryptoValue.bestBid);
			log(orderDetails.summary);

			ordersPlaced.push(orderDetails);

			continue;
		}

	}

	return { ordersPlaced, config };
}


const isScheduledEvent = event => event['detail-type'] && event['detail-type'] === 'Scheduled Event';

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
