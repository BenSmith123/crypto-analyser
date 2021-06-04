
const moment = require('moment-timezone');

const { INTERNAL_RUN, CONSOLE_LOG, DATETIME_FORMAT } = require('./environment');
const { investmentConfigIsValid, updateConfigRecord } = require('./database');
let { loadInvestmentConfig, updateInvestmentConfig } = require('./database');
let { getAccountSummary, getAllCryptoValues, checkLatestValueTrend, placeBuyOrder, placeSellOrder, processPlacedOrder } = require('./crypto');
const { calculatePercDiff, round, formatOrder, formatPriceLog, logToDiscord } = require('./helpers');
const { log, getLogs } = require('./logging');

/* eslint-disable no-await-in-loop */


/**
 * Lambda handler function!
 *
 * @param {object} event - AWS Lambda function event
 * @param {object} [mockFunctions=null] - optional, used for debugging/analysis in INTERNAL_RUN mode
 * @returns
 */
exports.main = async function (event, mockFunctions = null) {

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
		processPlacedOrder = () => {};
		checkLatestValueTrend = () => false;
	}

	const investmentConfig = await loadInvestmentConfig();

	if (!investmentConfigIsValid(investmentConfig)) {
		// log error and end lambda (without updating to a paused state)
		await logToDiscord(`An error occurred validating database config: \n\nConfig: ${JSON.stringify(investmentConfig, null, 4)}`, true);
		return []; // end lambda
	}

	if (investmentConfig.isPaused) {
		// don't send as alert since whatever caused the pause would have done that already
		await logToDiscord('Paused');
		return []; // end lambda
	}

	try {

		const results = await makeCryptoCurrenciesTrades(investmentConfig);

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
		await logToDiscord(`An unexpected error has occurred: ${err.message}\n\nDate: ${moment(Date.now()).format(DATETIME_FORMAT)}\n\nStack: ${err.stack}`, true);

		investmentConfig.isPaused = true;
		await updateInvestmentConfig(investmentConfig);

		return err; // end lambda

	} finally {

		// send the runtime logs to discord
		const runtimeLogs = getLogs();

		if (runtimeLogs.length) {
			if (CONSOLE_LOG) {
				console.log(runtimeLogs);
			} else {
				await logToDiscord(runtimeLogs.join('\n'));
			}
		}
	}

};


// main function for handling the buying/selling of the crypto currencies
async function makeCryptoCurrenciesTrades(investmentConfig) {

	let account;
	let refreshAccount = true;
	let config = investmentConfig;

	const ordersPlaced = [];

	// get crypto value of each crypto targetted
	const cryptoValues = await getAllCryptoValues(config.currenciesTargeted);
	const cryptoValueNames = Object.keys(cryptoValues);

	for (let i = 0; i < cryptoValueNames.length; i++) {

		if (refreshAccount) {
			// initial check or after every transaction - get new account data
			account = await getAccountSummary();
			refreshAccount = false;
		}

		// can try buy if there is USDT funds - $1 or more
		const canBuy = (account.USDT && account.USDT.available >= 1) || false;

		// can try sell if there are any cryptos that aren't just USDT
		const canSell = Object.keys(account).length > 1 || !account.USDT;

		// store amount of USDT available if it exists
		const availableUSDT = canBuy
			? Math.floor(account.USDT.available) // ignore fractions of cents
			: 0;

		if (!canBuy && !canSell) {
			// no more actions to take, log to discord and return
			logToDiscord('No funds or crypto currencies to trade', true);
			break;
		}

		const cryptoName = cryptoValueNames[i];
		const cryptoValue = cryptoValues[cryptoName];

		let cryptoPrice = cryptoValue.bestAsk; // bestAsk for any buy orders, bestBid for sell orders

		// database transaction record of the crypto
		const cryptoRecord = config.records[cryptoName];
		const { thresholds, limitUSDT } = cryptoRecord;

		// if no limit set, or there isn't enough available USDT use all available USDT
		const amountUSDT = !limitUSDT || limitUSDT > availableUSDT
			? availableUSDT
			: limitUSDT;

		// if there is no buy or sell record of the crypto
		const initialBuy = canBuy && !cryptoRecord.lastSellPrice && !cryptoRecord.lastBuyPrice;

		if (!initialBuy && !cryptoRecord.lastSellPrice && !cryptoRecord.lastBuyPrice) {
			// if price then log and skip to the next crypto
			logToDiscord(`${cryptoName} database record has no last sell or last buy price`, true);
			continue;
		}

		// set forceBuy to true if it's the first buy, otherwise use config
		const forceBuy = initialBuy === true || cryptoRecord.forceBuy;
		const { simpleLogs } = config.options;

		// check for BUY condition
		if (cryptoRecord.lastSellPrice || forceBuy) {

			if (limitUSDT > availableUSDT) {
				log(`[Warning] You do not have enough USDT funds ($${availableUSDT}) to meet the specified limit for ${cryptoName} ($${limitUSDT}), all available funds will be used in a buy scenario`);
			}

			let percentageDiff;

			if (!forceBuy) {
				// if previously bought, buy back in if price is < x percent less than last sell price
				percentageDiff = calculatePercDiff(cryptoPrice, cryptoRecord.lastSellPrice);

				log(formatPriceLog(cryptoName, 'sold', cryptoRecord.lastSellPrice, cryptoPrice, percentageDiff, simpleLogs));
			}

			// crypto is down more than x %
			if (forceBuy || percentageDiff < thresholds.buyPercentage) {

				if (!forceBuy && await checkLatestValueTrend(cryptoName, false)) {
					// if the crypto value is still decreasing, hold off buying!
					log(`${cryptoName} is still decreasing, holding off buying..`);
					continue;
				}

				// TODO - stack promises.all?
				const order = await placeBuyOrder(cryptoName, amountUSDT);

				const orderValue = await processPlacedOrder(order?.result?.order_id);

				// use the confirmed value if the order was filled immediately
				config = updateConfigRecord(config, cryptoName, orderValue || cryptoValue, true, limitUSDT);

				const orderDetails = formatOrder('buy', cryptoName, amountUSDT, cryptoPrice, orderValue);
				log(orderDetails.summary);

				if (forceBuy && !initialBuy) {
					log(`Force buy was used - if you already had ${cryptoName}, the last buy price will be overridden by this buy price.`);
				}

				ordersPlaced.push(orderDetails);
				refreshAccount = true;
			}

			continue;
		}

		// check for SELL condition

		cryptoPrice = cryptoValue.bestBid;
		const percentageDiff = calculatePercDiff(cryptoPrice, cryptoRecord.lastBuyPrice);

		log(formatPriceLog(cryptoName, 'bought', cryptoRecord.lastBuyPrice, cryptoPrice, percentageDiff, simpleLogs));

		// log a warning if price has dropped below the specified percentage
		if (thresholds.warningPercentage && percentageDiff < thresholds.warningPercentage) {
			log(`[Warning] ${cryptoName} is now ${percentageDiff.toFixed(2)}% since purchasing, consider selling`);
		}

		const sellAtLoss = thresholds.stopLossPercentage
		&& percentageDiff < thresholds.stopLossPercentage;

		const forceSell = sellAtLoss || cryptoRecord.forceSell;

		// crypto is up more than x %
		if (percentageDiff > thresholds.sellPercentage || forceSell) {

			// ignore this step if any of the hard-sell conditions are met
			if (!forceSell && await checkLatestValueTrend(cryptoName, true)) {
				// if the crypto value is still increasing, hold the crypto!
				log(`${cryptoName} is still increasing, holding off selling..`);
				continue;
			}

			// otherwise, crypto value is up but not consistently, sell!
			const availableCrypto = round(account[cryptoName].available, cryptoName);

			const order = await placeSellOrder(cryptoName, availableCrypto);

			const orderValue = await processPlacedOrder(order.result?.order_id);

			let valueUSDT;

			if (limitUSDT) {
				// get the USDT value of the sell to store
				valueUSDT = Math.floor((orderValue || cryptoPrice) * availableCrypto);
				// TODO - use the price when the order was filled otherwise this might be slightly off
				// ^ might not matter since the next buy scenario the price of the coin should have dropped
			}

			config = updateConfigRecord(config, cryptoName, orderValue || cryptoPrice, false, valueUSDT);

			const orderDetails = formatOrder('Sell', cryptoName, availableCrypto, cryptoPrice, orderValue);
			log(orderDetails.summary);

			// if crypto was sold because of the stopLossPercentage
			if (sellAtLoss) {
				log(`${cryptoName} stop-loss threshold was met`);
			}

			ordersPlaced.push(orderDetails);
			refreshAccount = true;
		}

	}

	return { ordersPlaced, config };
}


const isScheduledEvent = event => event['detail-type'] && event['detail-type'] === 'Scheduled Event';
