
const crypto = require('crypto-js');
const { writeFileSync } = require('fs');


const calculateDiffPerc = (a, b) => 100 * ((a - b) / ((a + b) / 2));

/**
 * @param {object} data
 * @param {string=} fileName - optional
 */
const saveJsonFile = (data, fileName) => {
	writeFileSync('z-temp.json' || fileName, JSON.stringify(data, null, 2));
};


function signRequest(request, apiKey, apiSecret) {

	const { id, method, params, nonce } = request;

	const paramsString = params == null
		? ''
		: Object.keys(params)
			.sort()
			.reduce((a, b) => a + b + params[b], '');

	const sigPayload = method + id + apiKey + paramsString + nonce;

	request.sig = crypto
		.HmacSHA256(sigPayload, apiSecret)
		.toString(crypto.enc.Hex);

	return request;
}

module.exports = {
	calculateDiffPerc,
	saveJsonFile,
	signRequest,
};
