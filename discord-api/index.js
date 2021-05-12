

const nacl = require('tweetnacl');
require('dotenv').config();


// map API endpoint paths to their functions
const API_ENDPOINTS = {
	root: respondToPing,
	commands: 'TODO',
};


exports.discordController = async function (event) {

	console.log(JSON.stringify(event));

	if (!requestIsValid(event)) {
		return {
			statusCode: '401',
			body: 'invalid request signature',
		};
	}

	// get the requested endpoint
	const endpoint = event.pathParameters && event.pathParameters.endpoint
		? event.pathParameters.endpoint
		: 'root';

	const a = await API_ENDPOINTS[endpoint];
	console.log(a);

	const response = {
		statusCode: 200,
		body: JSON.stringify(a),
	};

	return response;

};


function respondToPing() {
	return JSON.stringify({ type: 1 });
}


function requestIsValid({ headers, body }) {

	const { PUBLIC_KEY } = process.env;

	const signature = headers['X-Signature-Ed25519'];
	const timestamp = headers['X-Signature-Timestamp'];

	if (!signature || !timestamp) { return false; }

	return nacl.sign.detached.verify(
		Buffer.from(timestamp + body),
		Buffer.from(signature, 'hex'),
		Buffer.from(PUBLIC_KEY, 'hex'),
	);

}
