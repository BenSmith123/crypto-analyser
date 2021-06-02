
const axios = require('axios');
require('dotenv').config();

const url = 'https://discord.com/api/v8/applications/839044411249655828/commands';

const source = require('../src/data/discordCommands.json');

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

	const commandsToDelete = [
		'842303221548056577',
		'842347668625424404',
		'842374138874298368',
		'842573489608589333',
		'842573637507743744',
		'842573685755478076',
		'842580815808167997',
		'842636862778769409',
		'843708217715327036',
		'843710096190210068',
		'844055356371238913',
		'846920033434992730',
		'846920157153722379',
		'847284638912872498',
		'847284769908850698',
		'847654896491692072',
		'848009696031145984',
		'849150535475265537',
	];

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
