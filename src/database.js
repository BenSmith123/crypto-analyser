
const { DynamoDB } = require('aws-sdk');

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });
const DATABASE_TABLE = 'CRYPTO_TRANSACTIONS_TEST';


/**
 * Returns the investment configuration data from the database
 */
async function loadInvestmentConfig() {

	// const params = {
	// TableName: DATABASE_TABLE,
	// Key: {
	// id: 'configuration',
	// },
	// };

	// const a = await dynamoClient.get(params).promise();
	// console.log(a.Item);


	// TODO - replace with database call
	// - move the databaseInvestmentTemplate out of src so its not deployed to lambda
	return require('./databaseInvestmentTemplate.json'); // eslint-disable-line
}


/**
 * Returns true if the database investment state data is valid
 */
function validateInvestmentConfig(data) {

	if (data.id === 'configuration'
	// && data.isPaused
	&& data.sellPercentage
	&& data.buyPercentage
	&& data.transactions
	&& Object.keys(data.currenciesTargeted).length) {
		// TODO - loop over the transactions list and validate each one
		return true;
	}

	return false;
}


/**
 * Returns the database investment configuration with the updated transactions data
 *
 * @param {object} investmentConfig
 * @param {string} name - currency name
 * @param {object} value
 * @param {boolean} isBuyOrder
 * @returns
 */
function updateTransactions(investmentConfig, name, value, isBuyOrder) {

	const buyOrSellKey = isBuyOrder
		? 'lastBuyPrice'
		: 'lastSellPrice';

	const buyOrSellValue = isBuyOrder
		? value.bestAsk
		: value.bestBid;

	const updatedConfig = investmentConfig;

	// update transaction record of the current
	updatedConfig.transactions[name] = {
		[buyOrSellKey]: buyOrSellValue,
		orderPlaced: Date.now(), // new Date(),
		// TODO - add order Id etc. to this
	};

	return updatedConfig;
}


/**
 * Updates the investment configuration data in the database and uploads
 * to the database if the config is valid
 */
async function updateInvestmentConfig(config) {

	if (!config.id || config.id !== 'configuration') { throw new Error('Missing config id'); }

	const params = {
		TableName: DATABASE_TABLE,
		Item: config,
	};

	validateInvestmentConfig(config);

	return dynamoClient.put(params).promise(params);
}


/**
 * Saves a transaction to the database
 */
async function saveTransaction(transaction) {

	if (!transaction.id) { throw new Error('Missing transaction id'); }

	const params = {
		TableName: DATABASE_TABLE,
		Item: transaction,
	};

	return dynamoClient.put(params).promise();
}


module.exports = {
	loadInvestmentConfig,
	validateInvestmentConfig,
	updateTransactions,
	updateInvestmentConfig,
	saveTransaction,
};
