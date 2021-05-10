
const axios = require('axios');


const version = 'v1.0.1';

const announcement = `Bot upgraded to ${version}
 - Log to #logs channel when transactions are made (instead of just logging to #alerts)
 - [dev] Simplify discord URLs when setting up - use the full URL
 - [dev] Automate code configuration settings when setting up new accounts
`;


(async () => {

	console.log(announcement);

	await logToDiscord(announcement);

})();


async function logToDiscord(message) {


	if (!message) { throw new Error('No message content'); }

	const data = {
		username: `Analyser ${version}`,
		content: message,
	};

	const params = {
		url: 'https://discord.com/api/webhooks/839816114094866463/UYjXAY_evzfnCKohuFNNFnG7IOQlNhigZKvaCZ0juPz0HZSD7MtCptGcVIj1kOhMl7z2',
		method: 'POST',
		data,
		headers: {
			'Content-Type': 'application/json',
		},
	};

	try {
		return await axios(params);
	} catch (err) {
		// suppress error
		console.log('Error sending message to discord: ', err);
		return err;
	}
}
