
const { getOrderDetail } = require('../src/crypto');


process.env.API_KEY = '';
process.env.API_SECRET = '';


(async () => {

	const orderId = '1690510435207149122';

	const res = await getOrderDetail(orderId);

	console.log(JSON.stringify(res.data));

})();
