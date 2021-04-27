

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
function validateInvestmentState(data) {

	if (data.id === 'configuration'
	// && data.isPaused
	&& data.sellPercentage
	&& data.buyPercentage
	&& data.transactionsLatest
	&& Object.keys(data.currenciesTargeted).length) {
		// TODO - loop over the transactions list and validate each one
		return true;
	}

	return false;
}


/**
 * Updates the investment configuration data in the database
 */
async function updateInvestmentConfig() {

	return null;
}

module.exports = {
	loadInvestmentConfig,
	validateInvestmentState,
	updateInvestmentConfig,
};
