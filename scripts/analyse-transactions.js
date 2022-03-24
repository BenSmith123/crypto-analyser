/* eslint-disable no-console */

const { DynamoDB } = require('aws-sdk'); // eslint-disable-line
const { writeFileSync } = require('fs');

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });

process.env.AWS_PROFILE = 'bensmith';

const TableName = 'CRYPTO_TRANSACTIONS';

// update me
const USER_ID = '824023199607685201';


/**
 * @param {string} userId
 */
async function getAllTransactionsForUser(userId) {

	if (!userId) { throw new Error('No userId provided'); }

	const params = {
		TableName,
		KeyConditionExpression: '#user = :userId',
		IndexName: 'user-index',
		ExpressionAttributeValues: {
			':userId': userId,
		},
		ExpressionAttributeNames: {
			'#user': 'user',
		},
	};

	const result = await dynamoClient.query(params).promise();

	return result.Items;
}


/**
 * Returns all transactions in the database with full detail + the total
 */
async function getAllTransactions() {

	let concatData = [];
	const params = { TableName };

	const getAllData = async lastEvaluatedKey => {

		if (lastEvaluatedKey) { params.ExclusiveStartKey = lastEvaluatedKey; }

		const chunk = await dynamoClient.scan(params).promise();

		if (chunk.LastEvaluatedKey) {
			concatData = concatData.concat(chunk.Items);
			return getAllData(chunk.lastEvaluatedKey);
		}

		return concatData.concat(chunk.Items);
	};

	return getAllData();
}


/**
 * Returns summary data of all transactions
 */
function analyseTransactions(transactions) {

	let totalTransactions = 0;
	let totalBuys = 0;
	let totalSells = 0;
	let totalBuyUSD = 0;
	let totalSoldUSD = 0;
	const currencies = [];

	transactions.forEach(transaction => {
		const {
			side,
			cumulative_value: amountUSD,
			instrument_name, // eslint-disable-line camelcase
		} = transaction.order_info;

		const currencyCode = instrument_name.split('_')[0];

		if (!currencies.find(code => code === currencyCode)) { currencies.push(currencyCode); }

		totalTransactions++;

		if (side === 'BUY') {
			totalBuys++;
			totalBuyUSD += amountUSD;
		}

		if (side === 'SELL') {
			totalSells++;
			totalSoldUSD += amountUSD;
		}
	});

	return {
		totalTransactions,
		totalBuys,
		totalSells,
		totalBuyUSD,
		totalSoldUSD,
		totalCurrencies: currencies.length,
		currencies: currencies.sort(),
	};

}


(async () => {

	try {
		// const a = await getAllTransactionsForUser(USER_ID);
		// console.log(a);

		// get all transactions
		const transactions = await getAllTransactions();
		// const transactions = require('../ztransactions.json').transactions; // eslint-disable-line

		const results = analyseTransactions(transactions);

		// generate temp json file with results
		writeFileSync('transactions-summary.json', JSON.stringify(results, null, 4));


	} catch (err) {
		console.log(err);
	}

})();
