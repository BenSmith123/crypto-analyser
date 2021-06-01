
const axios = require('axios');
require('dotenv').config();

const url = 'https://discord.com/api/v8/applications/839044411249655828/commands';

const source = require('../src/data/discordCommands-v2.json');

const commandToUpdate = 'add-crypto'; // UPDATE ME

const json = source.commands.find(c => c.name === commandToUpdate);

if (!json) {
	throw new Error('No command found');
}

const headers = {
	Authorization: `Bot ${process.env.BOT_TOKEN}`,
};

(async () => {

	// const a = await deleteCommand('849150535475265537');
	// const a = await getCommands();
	// console.log(a);

	const req = {
		url,
		data: json,
		method: 'post',
		headers,
	};

	try {
		const result = await axios(req);
		console.log('Success!', result);
	} catch (err) {
		console.log('Error:', err.messages);
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
