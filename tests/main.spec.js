
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

setupStubs();
// ^ with object destructuring in index.js this has to be stubbed BEFORE index.js is required

const index = rewire('../src/index');


function setupStubs() {

	sinon.stub(helperModule, 'logToDiscord').callsFake(overrideLogToDiscord);

	const mockCryptoValue = {
		DOGE: {
			bestBid: 0.4,
			bestAsk: 0.3,
		},
	};

	const mockAccount = {
		BTC: { balance: 0.00026717, available: 0.00026717, order: 0, stake: 0, currency: 'BTC' },
		DOGE: { balance: 31, available: 31, order: 0, stake: 0, currency: 'DOGE' },
		USDT: { balance: 8.8377054, available: 8.8377054, order: 0, stake: 0, currency: 'USDT' },
		CRO: { balance: 0.01879796, available: 0.01879796, order: 0, stake: 0, currency: 'CRO' },
	};

	// override return values of external functions
	sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
	sinon.stub(cryptoModule, 'getAccountSummary').returns(mockAccount);
	sinon.stub(cryptoModule, 'checkLatestValueTrend').returns(false);
	sinon.stub(cryptoModule, 'placeSellOrder').returns({ result: { order_id: '078340' } });
	sinon.stub(cryptoModule, 'processPlacedOrder').returns(12.4);

	spyformatPriceLog = sinon.spy(helperModule, 'formatPriceLog');
}


const testScenarios = [
	{
		description: 'Should successfully place a sell order',
		inputConfig: require('./database-config/sellExample.json'),
	},
];


testScenarios.forEach(({ description, inputConfig }) => describe('#makeCryptoCurrenciesTrades', () => {

	let makeCryptoCurrenciesTrades;

	before(() => {
		// sinon.stub(databaseModule, 'loadInvestmentConfig').returns('hello');
		makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');
	});

	it(description, async () => {

		const { config, ordersPlaced } = await makeCryptoCurrenciesTrades(inputConfig);

		assert.isTrue(investmentConfigIsValid(config), 'should be updated and valid for next run');

		const currentRecord = config.records.DOGE;

		assert.equal(currentRecord.isHolding, false);
		assert.equal(currentRecord.limitUSDT, 384);
		assert.equal(currentRecord.lastSellPrice, 12.4);

		assert.equal(currentRecord.thresholds.buyPercentage, -1);
		assert.equal(currentRecord.thresholds.sellPercentage, 3);
		assert.equal(currentRecord.thresholds.stopLossPercentage, -10);

		assert.equal(ordersPlaced.length, 1);

		// TODO - maybe test this individually and check values less specifically
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

		assert.isString(ordersPlaced[0].date);
		delete ordersPlaced[0].date; // date is dynamic, remove before comparing

		assert.deepEqual(ordersPlaced[0], expectedOrderObj);

		console.log(getLogs());
	});

}));


function overrideLogToDiscord(message, isAlert) {

	if (typeof message !== 'string') {
		console.log(JSON.stringify(message, null, 4).replace(/"|,/g, ''));
		return;
	}

	console.log(message);
}
