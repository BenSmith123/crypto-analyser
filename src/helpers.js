
const axios = require('axios');
const { writeFileSync } = require('fs');

const { DISCORD_ENABLED } = require('./environment');

const { name, version } = require('../package.json');

const discordApi = 'https://discord.com/api/webhooks';


const calculateDiffPerc = (a, b) => 100 * ((a - b) / ((a + b) / 2));

/**
 * @param {object} data
 * @param {string=} fileName - optional
 */
const saveJsonFile = (data, fileName) => {
	writeFileSync(fileName || 'z-temp.json', JSON.stringify(data, null, 4));
};


/**
 * Sends a POST request message to discord
 *
 * @param {string|object} message
 * @param {boolean} [isTransaction=false] - optional: log to #transactions instead of #logs channel
 */
async function postToDiscord(message, isTransaction = false) {

	if (!DISCORD_ENABLED) { return null; }

	if (!message) { throw new Error('No message content'); }

	const url = isTransaction
		? `${discordApi}/834201420302647306/3UyU72vcsRwstQmYjiMxb-5d7YSIDNDu1QWz2vMg_Y5nQsP5X05vgMr-PvYqma15MinZ`
		: `${discordApi}/834182612419346432/0cvHHmrCE0tXAGmzr_l4RgGvEl7LhVgd4cej0g_rOjSrhcKcEjoyAYkRIh-lJHa0FnPy`;

	const data = {
		username: `${name} v${version}`,
		content: message,
	};

	if (typeof message !== 'string') { data.content = JSON.stringify(message); }

	const params = {
		url,
		method: 'POST',
		data,
		headers: {
			'Content-Type': 'application/json',
		},
	};

	try {
		return axios(params);
	} catch (err) {
		// suppress error
		console.log('Error sending message to discord: ', err);
		return err;
	}
}


module.exports = {
	calculateDiffPerc,
	saveJsonFile,
	postToDiscord,
};
