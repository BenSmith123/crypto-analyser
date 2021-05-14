
const axios = require('axios');
require('dotenv').config();

const url = 'https://discord.com/api/v8/applications/839044411249655828/commands';

const json = {
	name: 'set-buy-percentage',
	description: 'Sets the BUY percentage threshold (the decrease that has to meet before buying back to the crypto)',
	options: [
		{
			name: 'percentage',
			description: '-',
			type: 4, // 3 = string, 4 = int, 5 = boolean
			required: true,
		},
	],
};

const headers = {
	Authorization: `Bot ${process.env.BOT_TOKEN}`,
};

(async () => {

	// const a = await deleteCommand('841811603678691358');
	// await getCommands();

	const req = {
		url,
		data: json,
		method: 'post',
		headers,
	};

	try {
		const a = await axios(req);
		console.log(a);
	} catch (err) {
		console.log(err);
	}

})();


/**
 * Returns the discord slash commands
 */
async function getCommands() {
	return axios({
		url,
		headers,
	});
}


/**
 * Deletes a discord slash command
 *
 * @param {string} commandId
 */
async function deleteCommand(commandId) {
	return axios({
		url: `${url}/${commandId}`,
		method: 'delete',
		headers,
	});
}
