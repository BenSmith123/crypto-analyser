
const data = require('./resources/crypto-api-response-examples/get-account-summary-all.json');


/* eslint-disable max-len */
/* eslint-disable no-return-assign */
/* eslint-disable no-param-reassign */


// map API response to meanings
const PRICE = {
	bestBid: 'b',
	bestAsk: 'k',
	latestTrade: 'a',
};


(async () => {


	const b = [
		{
			code: 0,
			method: 'public/get-ticker',
			result: {
				instrument_name: 'CRO_USDT',
				data: {
					i: 'CRO_USDT',
					b: 0.15900,
					k: 0.15916,
					a: 0.15916,
					t: 1619147323652,
					v: 95219143.095,
					h: 0.19251,
					l: 0.15450,
					c: -0.03025,
				},
			},
		},
		{
			code: 0,
			method: 'public/get-ticker',
			result: {
				instrument_name: 'BTC_USDT',
				data: {
					i: 'CRO_USDT',
					b: 0.15900,
					k: 0.15916,
					a: 0.15916,
					t: 1619147323652,
					v: 95219143.095,
					h: 0.19251,
					l: 0.15450,
					c: -0.03025,
				},
			},
		},
	];

	const c = b.reduce((currValuesFormatted, { result }) => ( // eslint-disable-line no-return-assign
		// split key name by _ (e.g. CRO_USDT becomes CRO)
		currValuesFormatted[result.instrument_name.split('_')[0]] = {
			bestBid: result.data.b,
			bestAsk: result.data.k,
			latestTrade: result.data.a,
		}, currValuesFormatted),
	{});

	console.log(c);


	// example:
	// {
	// 	CRO: {
	// 		bestBid: 0.159,
	// 		bestAsk: 0.15916,
	// 		latestTrade: 0.15916 },
	// 	BTC: {
	// 		bestBid: 0.159,
	// 		bestAsk: 0.15916,
	// 		latestTrade: 0.15916 },
	// };

	const a = data.result.accounts
		.filter(account => account.available > 0) // filter out accounts that have no crypto balance
		.reduce((acc, curr) => ( // eslint-disable-line no-return-assign
			acc[curr.currency] = { ...curr }, acc),
		{});

	console.log(Object.keys(a).length > 1 || !a.USDT);

	// a.filter((b) => b.currency !== 'USDT');


})();
