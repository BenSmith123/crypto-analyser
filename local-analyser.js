/**
 * Simulate running the code over x time period to see how it would have performed
 */

/* eslint-disable no-console */

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
	loadInvestmentState,
};


// /////// SCENARIO OPTIONS - CONFIGURE THESE ///////

const instrumentName = 'BTC_USDT'; // crypto currency to look at and it's value in comparison to another crypto
const intervalStr = '15m'; // interval used in the crypto-api query (also the mock scheduled time for every lambda invocation)
// interval options: 1m, 5m, 15m, 30m, 1h, 4h, 6h, 12h, 1D, 7D, 14D, 1M

/// /////////////////////////////////////////////////


const INTERVAL_NUM = parseInt(intervalStr);

const scheduledEventMock = {
	event: { 'detail-type': 'Scheduled Event' },
};


(async () => {

	const cryptoDataSource = `${API_URL}public/get-candlestick?instrument_name=${instrumentName}&timeframe=${intervalStr}`;
	console.log(`Querying ${cryptoDataSource}`);

	const response = await axios(cryptoDataSource);

	// save the API response as a JSON for analysis/debugging
	saveJsonFile(response.data, outputDirectory + resultsFileName);

	const cryptoValueList = response.data.result.data;

	console.log(`${cryptoValueList.length} data points found`);

	// map API response to meanings
	const PRICE = {
		bestBid: 'b',
		bestAsk: 'k',
		latestTrade: 'a',
	};

	const executionResults = [];

	for (let i = 0; i < cryptoValueList.length; i++) {
		const cryptoValue = cryptoValueList[i];

		// invoke the lambda function and pass in the mock crypto data
		const results = lambda.main(scheduledEventMock, cryptoValue);

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


function loadInvestmentState() {
	// NOTE - keep this up-to-date with the validateInvestmentData function
	return {
		id: 'configuration',
		inputDate: 0,
		action: 'BUY',
		firstTimeBuy: true,
		sellPercentage: 10,
		buyPercentage: 10,
		latest: {
			transactionType: 0,
			transactionTime: 0,
			buyPrice: 0,
			sellPrice: 0,
			targetBuyPrice: 0,
			targetSellPrice: 0,
		},
	};
}
