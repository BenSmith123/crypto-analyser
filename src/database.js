
// eslint-disable-next-line import/no-extraneous-dependencies
const { DynamoDB } = require('aws-sdk'); // lambda runtime has aws-sdk installed
const moment = require('moment-timezone');
const { USER_ID, DATETIME_FORMAT } = require('./environment');

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
			id: USER_ID || databaseId, // if there is a env var, use it otherwise use param
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
 * Returns a transaction from the database
 *
 * @param {string} orderId
 */
async function getTransaction(orderId) {

	const params = {
		TableName: DATABASE_TABLES.transactions,
		Key: {
			orderId,
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

	const cryptoTransactionKeys = Object.keys(data.records);

	if (data.id === USER_ID
	&& data.currenciesTargeted.length
	&& data.records
	&& cryptoTransactionKeys.length) {

		// currently optional config data:
		// && typeof data.isPaused !== 'undefined'
		// && data.user
		// && data.options)

		const validRecords = cryptoTransactionKeys.filter(cryptoName => {
			const record = data.records[cryptoName];

			// if isHolding is defined, record must have: true=lastBuyPrice false=lastSellPrice
			if (typeof record.isHolding !== 'undefined') {
				if (record.isHolding && !record.lastBuyPrice) { return false; }
				if (!record.isHolding && !record.lastSellPrice) { return false; }
			}

			return (record.thresholds
				&& record.thresholds.buyPercentage
				&& record.thresholds.sellPercentage
				// currently optional:
				// record.limitUSDT
				// record.stopLossPercentage
				// record.warningPercentage
			);
		});

		return validRecords.length === cryptoTransactionKeys.length;
	}

	return false;
}


/**
 * Returns the database investment configuration with the updated record data
 *
 * @param {object} investmentConfig
 * @param {string} name - currency name
 * @param {object} value
 * @param {boolean} isBuyOrder
 * @param {boolean} limitUSDT - optional
 * @returns
 */
function updateConfigRecord(investmentConfig, name, value, isBuyOrder, limitUSDT) {

	const updatedConfig = investmentConfig;
	const currentRecord = investmentConfig.records[name];

	const buyOrSellKey = isBuyOrder
		? 'lastBuyPrice'
		: 'lastSellPrice';

	// update transaction record
	const updatedRecord = {
		[buyOrSellKey]: value,
		isHolding: isBuyOrder, // if it was a buy order, we are holding the coin
		timestamp: Date.now(),
		orderDate: moment(Date.now()).format(DATETIME_FORMAT),
		...limitUSDT && { // if there was a limit, it is updated in sell transactions
			limitUSDT,
		},
	};

	// remove unused prices for simplicity
	if (isBuyOrder) {
		delete currentRecord.lastSellPrice;
		delete currentRecord.forceBuy; // delete temp flags
	} else {
		delete currentRecord.lastBuyPrice;
		delete currentRecord.forceSell;
	}

	updatedConfig.records[name] = {
		...currentRecord,
		...updatedRecord,
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

	await dynamoClient.put(params).promise(params);

	return config;
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
		timestamp: transaction.order_info.create_time,
		...transaction,
	};
}


module.exports = {
	loadInvestmentConfig,
	getTransaction,
	investmentConfigIsValid,
	updateConfigRecord,
	updateInvestmentConfig,
	saveTransaction,
};
