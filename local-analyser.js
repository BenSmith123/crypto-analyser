/**
 * Simulate running the code over x time period to see how it would have performed
 *
 * NOTE:
 * this is not 100% accurate as the candlestick data for a crypto currency does not map 1-to-1
 * to the bestAsk and bestBid prices returned in the ticker crypto currency values.
 *
 * This also simulates that the buy/sell orders go through at the exact prices the order was placed,
 * The price can vary slightly since orders are not always filled instantly!
 */

/* eslint-disable no-console */
/* eslint-disable max-len */

const axios = require('axios');
const fs = require('fs');

const lambda = require('./src/index');
const { API_URL } = require('./src/environment');
const { saveJsonFile } = require('./src/helpers');

const outputDirectory = 'analysis-output.private/';
const resultsFileName = 'crypto-api-results.json';


fs.mkdir(outputDirectory, { recursive: true }, err => { if (err) throw err; });


// mock functions passed in to the main code to replace external calls
const mockFunctions = {
	loadInvestmentConfig: () => databaseConfiguration,
	getAccountSummary: () => accountSummary,
	updateInvestmentConfig,
	getAllCryptoValues,
};


// /////// SCENARIO OPTIONS - CONFIGURE THESE ///////

const instrumentName = 'BTC_USDT'; // crypto currency to look at and it's value in comparison to another crypto
const intervalStr = '15m'; // interval used in the crypto-api query (also the mock scheduled time for every lambda invocation)
// interval options: 1m, 5m, 15m, 30m, 1h, 4h, 6h, 12h, 1D, 7D, 14D, 1M

const initialUSDT = 100; // account balance in USD ($100)

let databaseConfiguration = {
	id: 'configuration',
	inputDate: 10,
	isPaused: false,
	currenciesTargeted: [
		'CRO',
	],
	sellPercentage: 5,
	buyPercentage: 5,
	transactions: {
		// CRO: {
		// lastBuyPrice: 0.1,
		// },
	},
};

let accountSummary = { // mock of what crypto API account summary should return
	accounts: [
		{
			balance: 0,
			available: initialUSDT,
			order: 0,
			stake: 0,
			currency: 'USDT',
		},
	],
};

/// /////////////////////////////////////////////////


const cryptoName = instrumentName.split('_')[0]; // e.g. CRO_USDT becomes CRO
let currMockCryptoValue = null; // the current mock crypto values for this iteration

const scheduledEventMock = { 'detail-type': 'Scheduled Event' };


(async () => {

	const cryptoDataSource = `${API_URL}public/get-candlestick?instrument_name=${instrumentName}&timeframe=${intervalStr}`;
	console.log(`Querying ${cryptoDataSource}`);

	const response = await axios(cryptoDataSource);

	// save the API response as a JSON for analysis/debugging
	saveJsonFile(response.data, outputDirectory + resultsFileName);

	const cryptoValueList = response.data.result.data;

	console.log(`${cryptoValueList.length} data points found`);

	const executionResults = [];

	for (let i = 0; i < cryptoValueList.length; i++) {

		// set the mock value of the crypto to be used in this iteration
		currMockCryptoValue = cryptoValueList[i];

		// invoke the lambda function and pass in the mock functions
		const results = await lambda.main(scheduledEventMock, mockFunctions); // eslint-disable-line no-await-in-loop

		// if buy or sell order was made, update account summary for next iteration
		if (results) {
			updateAccountSummary(results, currMockCryptoValue.l);
		}

		const resultDetails = {
			num: i + 1,
			mockValue: currMockCryptoValue,
			output: results,
		};

		executionResults.push(resultDetails);
	}

	const analysisSummary = {
		timeExecuted: formatTime(Date.now()),
		mockDataUrl: cryptoDataSource,
		currencyTargetted: instrumentName,
		executionResults,
	};

	saveJsonFile(analysisSummary, outputDirectory + resultsFileName);

	console.log(`Done! Execution results stored in ${outputDirectory}`);

})();


/**
 * @param {number} unixTime
 * @returns {string} - e.g. 7:30:00 AM Thu Apr 15 2021
 */
function formatTime(unixTime) {
	const d = new Date(unixTime);
	return `${d.toLocaleTimeString()} ${d.toDateString()}`;
}


//                              dP         .8888b                              dP   oo
//                              88         88   "                              88
// 88d8b.d8b. .d8888b. .d8888b. 88  .dP    88aaa  dP    dP 88d888b. .d8888b. d8888P dP .d8888b. 88d888b. .d8888b.
// 88'`88'`88 88'  `88 88'  `"" 88888"     88     88    88 88'  `88 88'  `""   88   88 88'  `88 88'  `88 Y8ooooo.
// 88  88  88 88.  .88 88.  ... 88  `8b.   88     88.  .88 88    88 88.  ...   88   88 88.  .88 88    88       88
// dP  dP  dP `88888P' `88888P' dP   `YP   dP     `88888P' dP    dP `88888P'   dP   dP `88888P' dP    dP `88888P'
//

/**
 * mock functions that are injected in the code to avoid
 * making external API/database calls & transactions
 */


/**
 * Override the function that updates the config in the database and just modify the object
 */
function updateInvestmentConfig(config) {
	databaseConfiguration = config;
}

/**
 * Simulate the order being placed and override crypto API response
 */
function updateAccountSummary(orderPlaced, pricePerCoin) {

	const { accounts } = accountSummary;


	if (orderPlaced === 'buy') {

		// const usdtValue = accountSummary[0].available;
		const availableCoin = accounts[0].available / pricePerCoin;

		// simulate all USDT being sold for new coin
		accounts[0] = {
			balance: 0,
			available: 0,
			order: 0,
			stake: 0,
			currency: 'USDT',
		};

		accounts[1] = {
			balance: 0,
			available: availableCoin,
			order: 0,
			stake: 0,
			currency: cryptoName,
		};
	}

	if (orderPlaced === 'sell') {
		// const usdtValue = accountSummary[0].available;
		const availableUSDT = accounts[1].available * pricePerCoin;

		// simulate all USDT being sold for new coin
		accounts[0] = {
			balance: 0,
			available: availableUSDT,
			order: 0,
			stake: 0,
			currency: 'USDT',
		};

		accounts[1] = {
			balance: 0,
			available: 0,
			order: 0,
			stake: 0,
			currency: cryptoName,
		};
	}

	console.log(accountSummary);

}


/**
 * Returns an object of a single currency value for each iteration
 *
 * @returns {object}
 * @example { CRO: { bestBid: 0.159, bestAsk: 0.15916, latestTrade: 0.15916 }, ... }
 */
function getAllCryptoValues() {

	// NOTE - the candlestick data isn't 1-to-1 with the ticker data
	// map the bestBid and bestAsk values to low (l) or high (h) values for most accurate result
	return {
		[cryptoName]: {
			bestBid: currMockCryptoValue.l, // low value
			bestAsk: currMockCryptoValue.l,
		},
	};

	// return currMockCryptoValue.reduce((currValuesFormatted, valueRaw) => (
	// currValuesFormatted[valueRaw.instrument_name.split('_')[0]] = { // eslint-disable-line
	// bestBid: valueRaw.data.b,
	// bestAsk: valueRaw.data.k,
	// latestTrade: valueRaw.data.a,
	// }, currValuesFormatted), // eslint-disable-line no-sequences
	// {});
}

