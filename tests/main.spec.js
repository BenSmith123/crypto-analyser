
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


let spyformatPriceLog;
const stubs = {};


const mockAccount = {
	BTC: { balance: 0.005, available: 0.005, currency: 'BTC' },
	DOGE: { balance: 31, available: 31, currency: 'DOGE' },
	USDT: { balance: 8.8377054, available: 8.8377054, currency: 'USDT' },
	CRO: { balance: 0.01879796, available: 0.01879796, currency: 'CRO' },
};

// spyformatPriceLog = sinon.spy(helperModule, 'formatPriceLog');


function overrideLogToDiscord(message, isAlert) {

	if (typeof message !== 'string') {
		console.log(JSON.stringify(message, null, 4).replace(/"|,/g, ''));
		return;
	}

	console.log(message);
}


describe('#makeCryptoCurrenciesTrades', () => {

	let makeCryptoCurrenciesTrades;

	before(() => {
		sinon.stub(helperModule, 'logToDiscord').callsFake(overrideLogToDiscord);

		sinon.stub(cryptoModule, 'getAccountSummary').returns(mockAccount);
		sinon.stub(cryptoModule, 'checkLatestValueTrend').returns(false);
		sinon.stub(cryptoModule, 'placeSellOrder').returns({ result: { order_id: '078340' } });
	});

	afterEach(() => {
		stubs.getAllCryptoValues.restore();
		stubs.processPlacedOrder.restore();
	});

	describe('Feature: Standard sell order', () => {

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

		it('should have updated the current record of the config', async () => {

			const inputConfig = require('./database-config-mock/sell.json');

			const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

			// test database configuration
			assert.isTrue(investmentConfigIsValid(config), 'expect config to be valid for next run');

			const currentRecord = config.records.DOGE;

			assert.equal(currentRecord.isHolding, false);
			assert.equal(currentRecord.limitUSDT, 384);
			assert.equal(currentRecord.lastSellPrice, 12.4);

			assert.equal(currentRecord.thresholds.buyPercentage, -1);
			assert.equal(currentRecord.thresholds.sellPercentage, 3);
			assert.equal(currentRecord.thresholds.stopLossPercentage, -10);

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

			stubs.getAllCryptoValues = sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
			stubs.processPlacedOrder = sinon.stub(cryptoModule, 'processPlacedOrder').returns(0.25);

			const index = rewire('../src/index');
			makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');
		});

		it('should have valid config for next run', async () => {

			const inputConfig = require('./database-config-mock/sellStoploss.json');

			const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

			// test database configuration
			assert.isTrue(investmentConfigIsValid(config), 'expect config to be valid for next run');

			const currentRecord = config.records.BTC;

			// const testThis = {
			// 	limitUSDT: 10,
			// 	isHolding: false,
			// 	orderDate: '14/06/2021, 15:45pm',
			// 	timestamp: 1623642347339,
			// 	thresholds: { stopLossPercentage: -1, sellPercentage: 32.99, buyPercentage: 1 },
			// 	breakEvenPrice: 0.3487833,
			// 	pauseAfterSell: true,
			// 	isAtLoss: true,
			// 	lastSellPrice: 0.25,
			// };

		});

	});

});
