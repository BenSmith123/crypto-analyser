
/**
 * Discord slash commands guide: https://discord.com/developers/docs/interactions/slash-commands
 *
 * Commands:
 *
 */

const nacl = require('tweetnacl');
require('dotenv').config();


// map API endpoint paths to their functions
const API_ENDPOINTS = {
	root: respondToPing,
	commands: 'TODO',
};


exports.discordController = async function (event) {

	console.log('event: ', JSON.stringify(event));

	if (!requestIsValid(event)) {
		return {
			statusCode: '401',
			body: 'invalid request signature',
		};
	}

	// get the requested endpoint
	// const endpoint = event.pathParameters && event.pathParameters.endpoint
	// 	? event.pathParameters.endpoint
	// 	: 'root';

	const body = JSON.parse(event.body) || null;

	const a = await API_ENDPOINTS[endpoint]();

	const response = {
		statusCode: 200,
		body: a,
	};

	return response;

};


function respondToPing() {
	// return JSON.stringify({ type: 1 });

	return JSON.stringify({
		type: 4,
		data: {
			content: 'Congrats on sending your command!',
		},
	});
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
