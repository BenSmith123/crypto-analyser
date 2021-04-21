/**
 * Simulate an AWS Lambda invocation by passing the function an event
 */

const lambda = require('./src/index');

// const mockEvent = require('./resources/example-lambda-cron.json');

const scheduledEventMock = {
	event: { 'detail-type': 'Scheduled Event' },
};


(async () => {

	console.log('Running lambda function code..');

	const response = await lambda.main(scheduledEventMock);

	console.log('Lambda function execution finished:', response);

})();
