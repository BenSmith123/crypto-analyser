
const nacl = require('tweetnacl');

const { loadInvestmentConfig } = require('../database');


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

	if (!userId) { throw new Error(`User does not exist: ID=${userId}`); }

	return loadInvestmentConfig(userId);
}


module.exports = {
	errorResponse,
	respondToPing,
	requestIsValid,
	getUserConfiguration,
};
