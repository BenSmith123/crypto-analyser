/**
 * The Crypto.com exchange API has an unresolved bug where at least half of the transactions
 * are not returned (even in a status 200 response).
 *
 * This script will retrieve the transactions listed for a given account and
 * store them in the database.
 *
 * The transaction order ID's can be found in the user logs - they are logged here
 * when there is a transaction retrieval issue.
 */

/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

const { getOrderDetail } = require('../src/crypto');
const { saveTransaction } = require('../src/database');

process.env.DISCORD_ENABLED = false;

/// UPDATE ME ///
process.env.API_KEY = '';
process.env.API_SECRET = '';

const ordersToSave = [
	'',
];
/// ///////// ///


(async () => {

	if (!process.env.API_KEY || !process.env.API_SECRET) {
		throw new Error('Missing API key or secret');
	}

	try {

		// don't bother stacking the promises just to make debugging easier
		for (let i = 0; i < ordersToSave.length; i++) {

			const orderId = ordersToSave[i];
			const order = await getOrderDetail(orderId);

			if (!order || !order.result) {
				console.log(`Error: Order ${orderId} not found`);

			} else if (!Object.keys(order.result).length) {
				console.log(`Error: Try again.. ${orderId}`);

			} else {
				await saveTransaction(order.result);
				console.log(`Order ${orderId} saved`);
			}
		}

		console.log('Done! :)');

	} catch (err) {
		console.log(err);
	}

})();

