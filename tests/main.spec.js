
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */


const sinon = require('sinon');
const rewire = require('rewire');
const { assert } = require('chai');


const { getLogs } = require('../src/logging');
const cryptoModule = require('../src/crypto');
const helperModule = require('../src/helpers');
// const databaseModule = require('../src/database');


let spyformatPriceLog;


setupStubs();
// ^ with object destructuring in index.js this has to be stubbed BEFORE index.js is required


const index = rewire('../src/index');

const { error } = require('./database-config/error.json');


function overrideLogToDiscord(message, isAlert) {

	if (typeof message !== 'string') {
		console.log(JSON.stringify(message, null, 4).replace(/"|,/g, ''));
		return;
	}

	console.log(message);
}


function setupStubs() {
	// sinon.stub(cryptoModule, 'getAllCryptoValues').returns('ffs');
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


	sinon.stub(cryptoModule, 'getAllCryptoValues').returns(mockCryptoValue);
	sinon.stub(cryptoModule, 'getAccountSummary').returns(mockAccount);
	sinon.stub(cryptoModule, 'checkLatestValueTrend').returns(false);
	sinon.stub(cryptoModule, 'placeSellOrder');
	sinon.stub(cryptoModule, 'processPlacedOrder').returns(12.4);


	spyformatPriceLog = sinon.spy(helperModule, 'formatPriceLog');

}


describe('model/users', () => {


	before(() => {


		// sinon.stub(databaseModule, 'loadInvestmentConfig').returns('hello');
	});

	const array = [1];

	array.forEach(element => {

		it('', async () => {


			const makeCryptoCurrenciesTrades = index.__get__('makeCryptoCurrenciesTrades');


			const results = await makeCryptoCurrenciesTrades(error);

			getLogs();

			assert.isString(console.log(spyformatPriceLog.returnValues[0]));

		});

	});


});
