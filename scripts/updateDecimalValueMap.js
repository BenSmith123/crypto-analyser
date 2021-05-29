/**
 * This script calls the crypto.com API to get all of the available crypto-currencies
 * that can be traded for USDT and the number of decimals that each one is traded at.
 * Generates results in a decimalValueMap-new.json
 *
 * The map is used in the crypto-bot transactions (src/data/decimalValueMap.json)
 * Compare the results and then override the existing decimalValueMap
 */

const axios = require('axios');
const { writeFileSync } = require('fs');


const API_ENDPOINT = 'https://api.crypto.com/v2/public/get-instruments';

(async () => {

	try {
		const res = await axios(API_ENDPOINT);

		const { instruments } = res.data.result;

		// get every crypto available on the crypto API that can be traded for USDT
		const decimalValueMap = instruments
			.filter(i => i.quote_currency === 'USDT')
			.map(instrument => ({
				instrument_name: instrument.instrument_name,
				base_currency: instrument.base_currency,
				price_decimals: instrument.price_decimals,
				quantity_decimals: instrument.quantity_decimals,
			}))
			.sort((a, b) => ((a.base_currency > b.base_currency) ? 1 : -1)); // sort alphabetically

		writeFileSync('decimalValueMap-new.json', JSON.stringify(decimalValueMap, null, 4));

		console.log(`Total currencies: ${decimalValueMap.length}`);

	} catch (err) {
		console.error(err);
	}

})();
