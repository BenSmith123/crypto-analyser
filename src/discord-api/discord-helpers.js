
const nacl = require('tweetnacl');

const { loadInvestmentConfig } = require('../database');


// map of discord ID's and their database config ID
const discordUserConfigMap = {
	'409274228794458113': 'configuration',
	'234154409033072650': 'configuration-jett',
	'604242730268491787': 'configuration-zlatko',
};


function errorResponse(err, statusCode = 400) {
	return {
		statusCode,
		body: err.message || err,
	};
}


function respondToPing() {
	return JSON.stringify({ type: 1 });
}


function requestIsValid({ headers, body }) {

	const { PUBLIC_KEY } = process.env;

	const signature = headers['x-signature-ed25519'];
	const timestamp = headers['x-signature-timestamp'];

	if (!signature || !timestamp) { return false; }

	return nacl.sign.detached.verify(
		Buffer.from(timestamp + body),
		Buffer.from(signature, 'hex'),
		Buffer.from(PUBLIC_KEY, 'hex'),
	);
}


/**
 * Returns the user database configuration
 *
 * @param {string} userId
 * @returns {object}
 */
async function getUserConfiguration(userId) {

	const configId = discordUserConfigMap[userId];

	if (!configId) { throw new Error(`User does not exist: ID=${userId}`); }

	return loadInvestmentConfig(configId);
}


module.exports = {
	errorResponse,
	respondToPing,
	requestIsValid,
	getUserConfiguration,
};
