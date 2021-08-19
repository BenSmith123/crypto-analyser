
const { DynamoDB } = require('aws-sdk'); // eslint-disable-line

/* eslint-disable no-console */

const dynamoClient = new DynamoDB.DocumentClient({ region: 'ap-southeast-2' });

const TableName = 'CRYPTO_TRANSACTIONS';

// update me
const USER_ID = '824023199607685201';


/**
 * @param {string} userId
 */
async function getAllTransactionsForUser(userId) {

	if (!userId) { throw new Error('No userId provided'); }

	const params = {
		TableName,
		KeyConditionExpression: '#user = :userId',
		IndexName: 'user-index',
		ExpressionAttributeValues: {
			':userId': userId,
		},
		ExpressionAttributeNames: {
			'#user': 'user',
		},
	};

	const result = await dynamoClient.query(params).promise();

	return result.Items;
}


/**
 *
 */
async function getAllTransactions() {

	let concatData = [];
	const params = { TableName };

	const getAllData = async lastEvaluatedKey => {

		if (lastEvaluatedKey) { params.ExclusiveStartKey = lastEvaluatedKey; }

		const chunk = await dynamoClient.scan(params).promise();

		if (chunk.LastEvaluatedKey) {
			concatData = concatData.concat(chunk.Items);
			return getAllData(chunk.lastEvaluatedKey);
		}

		return (concatData.concat(chunk.Items));
	};

	return getAllData();
}


(async () => {

	try {
		const a = await getAllTransactionsForUser(USER_ID);

		console.log(a);

		// const allTransaction = await getAllTransactions();

		// console.log(allTransaction);

	} catch (err) {
		console.log(err);
	}

})();
