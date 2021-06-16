
/* eslint-disable no-console */
/* eslint-disable max-len */
/* eslint-disable no-return-assign */
/* eslint-disable no-param-reassign */

// const bcrypt = require('bcrypt');

const axios = require('axios');

const { RSI } = require('technicalindicators');


(async () => {

	// const inputRSI = {
	// 	values: [127.75, 129.02, 132.75, 145.40, 148.98, 137.52, 147.38, 139.05, 137.23, 149.30, 162.45, 178.95, 200.35, 221.90, 243.23, 243.52, 286.42, 280.27, 277.35, 269.02, 263.23, 214.90],
	// 	period: 14,
	// };

	// const expectedResult = [
	// 	86.41, 86.43, 89.65, 86.50, 84.96, 80.54, 77.56, 58.06,
	// ];

	// console.log(RSI.calculate(inputRSI));

	const API_URL = 'https://api.crypto.com/v2';

	const instrumentName = 'DOGE_USDT';
	const timeframe = '1m';

	const candleStickEndpoint = `/public/get-candlestick?instrument_name=${instrumentName}&timeframe=${timeframe}`;

	const rawResponse = await axios(API_URL + candleStickEndpoint);

	const candlestickData = rawResponse.data.result.data;

	const cryptoValues = candlestickData.map(data => data.c); // NOTE array 0 is the oldest time

	console.log(candlestickData[cryptoValues.length - 1]);

	const lastFifthteen = cryptoValues.slice(-15);

	console.log(RSI.calculate({ values: lastFifthteen, period: 14 }));
	// console.log(RSI.calculate({ values: lastFifthteen.reverse(), period: 14 }));

	// console.log(rawResponse);


	/// /////////////////////////////////
	// example on storing passwords using hashing/salt
	// const saltRounds = 10;
	// const myPlaintextPassword = 's0/\/\P4$$w0rD';

	// bcrypt.genSalt(saltRounds, (err, salt) => {

	// console.log(salt);

	// bcrypt.hash(myPlaintextPassword, salt, (err, hash) => {
	// console.log(err, hash);


	// bcrypt.compare(myPlaintextPassword, hash, (err, result) => {
	// console.log(result);
	// });
	// });

	// });
	/// ////////////////////////////////

})();
