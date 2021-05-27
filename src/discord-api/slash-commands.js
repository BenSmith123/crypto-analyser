
const axios = require('axios');
const { API_URL } = require('../environment');


function getCommands() {
	const commandsJSON = require('../data/discordCommands.json'); // eslint-disable-line global-require

	const results = [];

	commandsJSON.commands.forEach(command => {
		results.push(`**/${command.name}**: ${command.description}`);
	});

	return results.join('\n');
}


function getChangelog() {

	const changelog = require('../data/changelog.json'); // eslint-disable-line global-require

	const results = [];

	changelog.logs.forEach(log => {
		results.push(`\n**v${log.version}**`);

		if (log.devChanges && log.devChanges.length) {
			log.devChanges.forEach(change => {
				results.push(`   - [dev] ${change}`);
			});
		}

		log.changes.forEach(change => {
			results.push(`   - ${change}`);
		});

	});

	return results.join('\n');
}


/**
 * Queries any crypto.com API endpoint and checks the data is valid
 */
async function checkCryptoApiStatus() {

	let isHealthy;

	try {
		const res = await axios(`${API_URL}public/get-instruments`);

		// even in status 200 scenarios the API can still return a 'maintenance page'
		isHealthy = res.data.result.instruments.length > 0;

	} catch (err) {
		isHealthy = false;
	}

	return isHealthy
		? 'Crypto.com exchange appears to be **healthy**'
		: 'Crypto.com exchange appears **down**!';
}


/**
 * Returns a list of the available crypto currencies on the crypto.com API
 * Available crypto currencies listed and can be traded into USDT
 *
 * @param {boolean} [returnArray] - optional (default false)
 * @returns {array|string}
 */
async function getAvailableCrypto(returnArray) {

	const res = await axios(`${API_URL}public/get-instruments`);

	const cryptoList = res.data.result.instruments
		.map(instrument => (instrument.instrument_name.includes('USDT')
			? instrument.base_currency
			: null))
		.filter(r => r !== null)
		.sort();

	return returnArray
		? cryptoList
		: `${cryptoList.join('\n')}\n${cryptoList.length} total crypto currencies available`;
}


module.exports = {
	getCommands,
	getChangelog,
	checkCryptoApiStatus,
	getAvailableCrypto,
};
