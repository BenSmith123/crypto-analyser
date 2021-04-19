
const lambda = require('./src/index.js');

// const mockEvent = require('./resources/example-lambda-cron.json');
const mockEvent = require('./resources/lambda-scheduled-job.json');


(async () => {

	console.log('Running lambda function code..');

	const response = await lambda.main(mockEvent);

	console.log('Lambda function execution finished:', response);

})();
