
// eslint-disable-next-line import/no-extraneous-dependencies
const { DynamoDB } = require('aws-sdk'); // lambda runtime has aws-sdk installed
const moment = require('moment-timezone');
const { DATABASE_ID, DATETIME_FORMAT } = require('./environment');

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });

const DATABASE_TABLES = {
	users: 'CRYPTO_USERS',
	transactions: 'CRYPTO_TRANSACTIONS',
};


/**
 * Returns the investment configuration data from the database
 */
async function loadInvestmentConfig(databaseId) {

	const params = {
		TableName: DATABASE_TABLES.users,
		Key: {
			id: DATABASE_ID || databaseId, // if there is a env var, use it otherwise use param
		},
	};

	return new Promise((resolve, reject) => {
		dynamoClient.get(params, (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data.Item);
			}
		});
	});
}


/**
 * Returns true if the database investment state data is valid
 */
function investmentConfigIsValid(data) {

	if (data.id === DATABASE_ID
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

	const updatedConfig = investmentConfig;

	// update transaction record of the current
	updatedConfig.transactions[name] = {
		[buyOrSellKey]: value,
		timestamp: Date.now(),
		orderDate: moment(Date.now()).format(DATETIME_FORMAT),
		// TODO - add order Id etc. to this
	};

	return updatedConfig;
}


/**
 * Updates the investment configuration data in the database and uploads
 * to the database if the config is valid
 */
async function updateInvestmentConfig(config) {

	if (!config.id) { throw new Error('Missing config ID'); }

	const params = {
		TableName: DATABASE_TABLES.users,
		Item: config,
	};

	investmentConfigIsValid(config);

	return dynamoClient.put(params).promise(params);
}


/**
 * Saves a transaction to the database
 */
async function saveTransaction(rawTransaction) {

	const transaction = formatTransaction(rawTransaction);

	if (!transaction.orderId) { throw new Error('Missing transaction orderId'); }

	const params = {
		TableName: DATABASE_TABLES.transactions,
		Item: transaction,
	};

	return dynamoClient.put(params).promise();
}


/**
 * Returns a formatted object of the raw transaction object so it can be stored in the database
 */
function formatTransaction(transaction) {
	return {
		orderId: transaction.order_info.order_id,
		user: transaction.order_info.client_oid,
		// expose important data at a higher level for easier access
		status: transaction.order_info.status,
		...transaction,
	};
}


module.exports = {
	loadInvestmentConfig,
	investmentConfigIsValid,
	updateTransactions,
	updateInvestmentConfig,
	saveTransaction,
};
