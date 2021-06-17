
/* eslint-disable no-underscore-dangle */
/* eslint-disable global-require */
/* eslint-disable no-console */

const sinon = require('sinon');
const rewire = require('rewire');
const { assert } = require('chai');

const { getLogs } = require('../src/logging');
const cryptoModule = require('../src/crypto');
const helperModule = require('../src/helpers');
const { investmentConfigIsValid } = require('../src/database');

const mockAccount = {
	BTC: { balance: 0.005, available: 0.005, currency: 'BTC' },
	DOGE: { balance: 31, available: 31, currency: 'DOGE' },
	USDT: { balance: 8.8377054, available: 8.8377054, currency: 'USDT' },
	CRO: { balance: 0.01879796, available: 0.01879796, currency: 'CRO' },
};

// const spyformatPriceLog = sinon.spy(helperModule, 'formatPriceLog');


function overrideLogToDiscord(message) {

	if (typeof message !== 'string') {
		console.log(JSON.stringify(message, null, 4).replace(/"|,/g, ''));
		return;
	}

	console.log(message);
}


describe('#makeCryptoCurrenciesTrades', () => {

	let makeCryptoCurrenciesTrades;
	const stubs = {};

	before(() => {
		sinon.stub(helperModule, 'logToDiscord').callsFake(overrideLogToDiscord);

		sinon.stub(cryptoModule, 'getAccountSummary').returns(mockAccount);
		sinon.stub(cryptoModule, 'checkLatestValueTrend').returns(false);
		sinon.stub(cryptoModule, 'placeSellOrder').returns({ result: { order_id: '078340' } });
		sinon.stub(cryptoModule, 'placeBuyOrder').returns({ result: { order_id: '0232236' } });

	});

	afterEach(() => {
		stubs.getAllCryptoValues.restore();
		stubs.processPlacedOrder.restore();
	});

	describe('Feature: Standard SELL order', () => {

		before(async () => {

			const mockCryptoValue = {
				DOGE: { bestBid: 0.4, bestAsk: 0.3 },
			};

			stubs.getAllCryptoValues = sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
			stubs.processPlacedOrder = sinon.stub(cryptoModule, 'processPlacedOrder').returns(12.4);

			const index = rewire('../src/index');
			makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');
			// ^ with object destructuring in index.js this has to be stubbed BEFORE index.js is rewired

		});

		it('should have updated configuration and valid order data', async () => {

			const inputConfig = require('./database-config-mock/sell.json');

			const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

			// TEST DATABASE CONFIGURATION
			assert.isTrue(investmentConfigIsValid(config), 'expect config to be valid for next run');

			const currentRecord = config.records.DOGE;

			assert.equal(currentRecord.isHolding, false);
			assert.equal(currentRecord.limitUSDT, 384);
			assert.equal(currentRecord.lastSellPrice, 12.4);

			assert.equal(currentRecord.thresholds.buyPercentage, -1);
			assert.equal(currentRecord.thresholds.sellPercentage, 3);
			assert.equal(currentRecord.thresholds.stopLossPercentage, -10);

			// dynamic data
			assert.isString(currentRecord.orderDate);
			assert.isNumber(currentRecord.timestamp);

			// TEST ORDER
			// maybe test this individually and check values less specifically
			const expectedOrderObj = {
				type: 'SELL',
				name: 'DOGE',
				amount: 31,
				valuePlaced: 0.4,
				valueFilled: 12.4,
				difference: '+14.67%',
				quantity: '384.40 USD',
				summary: 'Sell order FILLED for 31 DOGE at $12.4 USD',
				orderId: '078340',
			};

			assert.equal(ordersPlaced.length, 1);

			assert.isString(ordersPlaced[0].date);
			delete ordersPlaced[0].date; // date is dynamic, remove before comparing

			assert.deepEqual(ordersPlaced[0], expectedOrderObj);

			console.log(getLogs());
		});

	});


	describe('Feature: Stop-loss sell order', () => {

		before(async () => {

			const mockCryptoValue = {
				BTC: { bestBid: 0.248, bestAsk: 0.2475 },
			};

			const sellPrice = 0.25;

			stubs.getAllCryptoValues = sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
			stubs.processPlacedOrder = sinon.stub(cryptoModule, 'processPlacedOrder').returns(sellPrice);

			const index = rewire('../src/index');
			makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');
		});

		it('should have updated configuration and valid order data', async () => {

			const inputConfig = require('./database-config-mock/sellStoploss.json');

			const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

			// TEST DATABASE CONFIGURATION
			assert.isTrue(investmentConfigIsValid(config), 'expect config to be valid for next run');

			const currentRecord = config.records.BTC;

			assert.equal(currentRecord.isHolding, false);
			assert.equal(currentRecord.limitUSDT, 10);
			assert.equal(currentRecord.lastSellPrice, 0.25);

			// extra data added in stop-loss scenarios
			assert.equal(currentRecord.breakEvenPrice, 0.3487833);
			assert.isTrue(currentRecord.pauseAfterSell);
			assert.isTrue(currentRecord.isAtLoss);

			assert.equal(currentRecord.thresholds.buyPercentage, 1);
			assert.equal(currentRecord.thresholds.sellPercentage, 32.99);
			assert.equal(currentRecord.thresholds.stopLossPercentage, -1);

			// dynamic data
			assert.isString(currentRecord.orderDate);
			assert.isNumber(currentRecord.timestamp);

			// TEST ORDER
			const expectedOrderObj = {
				type: 'SELL',
				name: 'BTC',
				amount: 0.005,
				valuePlaced: 0.248,
				valueFilled: 0.25,
				difference: '-32.81%',
				quantity: '0.00 USD',
				summary: 'Sell order FILLED for 0.005 BTC at $0.25 USD',
				orderId: '078340',
			};

			assert.equal(ordersPlaced.length, 1);

			assert.isString(ordersPlaced[0].date);
			delete ordersPlaced[0].date; // date is dynamic, remove before comparing

			assert.deepEqual(ordersPlaced[0], expectedOrderObj);
		});
	});


	describe('Feature: Initial BUY order', () => {

		before(async () => {

			const mockCryptoValue = {
				DOGE: { bestBid: 0.4, bestAsk: 0.3 },
			};

			stubs.getAllCryptoValues = sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
			stubs.processPlacedOrder = sinon.stub(cryptoModule, 'processPlacedOrder').returns(12.4);

			const index = rewire('../src/index');
			makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');
		});

		it('should have updated configuration and valid order data', async () => {

			const inputConfig = require('./database-config-mock/buy-initial.json');

			const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

			// TEST DATABASE CONFIGURATION
			assert.isTrue(investmentConfigIsValid(config), 'expect config to be valid for next run');

			const currentRecord = config.records.DOGE;

			assert.equal(currentRecord.isHolding, true);
			assert.equal(currentRecord.limitUSDT, 100);
			assert.equal(currentRecord.lastBuyPrice, 12.4);
			assert.notExists(currentRecord.lastSellPrice);

			assert.equal(currentRecord.thresholds.buyPercentage, -3);
			assert.equal(currentRecord.thresholds.sellPercentage, 3);

			// dynamic data
			assert.isString(currentRecord.orderDate);
			assert.isNumber(currentRecord.timestamp);

			// TEST ORDER
			const expectedOrderObj = {
				type: 'BUY',
				name: 'DOGE',
				amount: 8,
				valuePlaced: 0.3,
				valueFilled: 12.4,
				quantity: '0.6451612903225806 DOGE',
				summary: 'Buy order FILLED for $8 USD worth of DOGE at 12.4',
				orderId: '0232236',
			};

			assert.equal(ordersPlaced.length, 1);

			assert.isString(ordersPlaced[0].date);
			delete ordersPlaced[0].date; // date is dynamic, remove before comparing

			assert.deepEqual(ordersPlaced[0], expectedOrderObj);
		});

	});


	describe('Feature: Standard BUY order (-10% of lastSellPrice)', () => {

		before(async () => {

			const mockCryptoValue = {
				DOGE: { bestBid: 90, bestAsk: 90 },
			};

			const sellPrice = 91.5;

			stubs.getAllCryptoValues = sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
			stubs.processPlacedOrder = sinon.stub(cryptoModule, 'processPlacedOrder').returns(sellPrice);

			const index = rewire('../src/index');
			makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');
		});

		it('should have updated configuration and valid order data', async () => {

			const inputConfig = require('./database-config-mock/buy-standard.json');

			const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

			// TEST DATABASE CONFIGURATION
			assert.isTrue(investmentConfigIsValid(config), 'expect config to be valid for next run');

			const currentRecord = config.records.DOGE;

			assert.equal(currentRecord.isHolding, true);
			assert.equal(currentRecord.lastBuyPrice, 91.5);
			assert.notExists(currentRecord.limitUSDT);
			assert.notExists(currentRecord.lastSellPrice);

			assert.equal(currentRecord.thresholds.buyPercentage, -3);
			assert.equal(currentRecord.thresholds.sellPercentage, 3);

			// dynamic data
			assert.isString(currentRecord.orderDate);
			assert.isNumber(currentRecord.timestamp);

			// TEST ORDER
			const expectedOrderObj = {
				type: 'BUY',
				name: 'DOGE',
				amount: 8,
				valuePlaced: 90,
				valueFilled: 91.5,
				quantity: '0.08743169398907104 DOGE',
				summary: 'Buy order FILLED for $8 USD worth of DOGE at 91.5',
				orderId: '0232236',
			};

			assert.equal(ordersPlaced.length, 1);

			assert.isString(ordersPlaced[0].date);
			delete ordersPlaced[0].date; // date is dynamic, remove before comparing

			assert.deepEqual(ordersPlaced[0], expectedOrderObj);
		});

	});

});
