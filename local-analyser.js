/**
 * Simulate running the code over x time period to see how it would have performed
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

// ensure no external API or database calls are made
process.env.INTERNAL_RUN = true;
process.env.DISCORD_ENABLED = false;

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

let databaseConfiguration = {
	id: 'configuration',
	inputDate: 0,
	isPaused: false,
	currenciesTargeted: [
		'CRO',
	],
	sellPercentage: 10,
	buyPercentage: 10,
	transactions: {
		CRO: {
			lastBuyPrice: 0.1,
		},
	},
};

const accountSummary = { // mock of what crypto API account summary should return
	accounts: [
		{
			balance: 0,
			available: 100, // $100 USD
			order: 0,
			stake: 0,
			currency: 'USDT',
		},
	],
};

/// /////////////////////////////////////////////////


const INTERVAL_NUM = parseInt(intervalStr);
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
		const results = lambda.main(scheduledEventMock, mockFunctions);

		const resultDetails = {
			num: i + 1,
			output: results,
		};

		executionResults.push(resultDetails);
	}

	const analysisSummary = {
		timeExecuted: formatTime(Date.now()),
		mockDataUrl: cryptoDataSource,
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
 * Returns an object of a single currency value for each iteration
 *
 * @returns {object}
 * @example { CRO: { bestBid: 0.159, bestAsk: 0.15916, latestTrade: 0.15916 }, ... }
 */
function getAllCryptoValues() {

	// eslint-disable-next-line no-return-assign
	return currMockCryptoValue.reduce((currValuesFormatted, valueRaw) => (
		// split key name by _ (e.g. CRO_USDT becomes CRO)
		currValuesFormatted[valueRaw.instrument_name.split('_')[0]] = { // eslint-disable-line
			bestBid: valueRaw.data.b,
			bestAsk: valueRaw.data.k,
			latestTrade: valueRaw.data.a,
		}, currValuesFormatted), // eslint-disable-line no-sequences
	{});
}

