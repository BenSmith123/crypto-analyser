/**
 * Simulate an AWS Lambda invocation by passing the function an event
 */

const lambda = require('../src/discord-api/index');

const mockDiscordCommand = require('../resources/lambda/lambda-api-gateway-discord.json');


(async () => {

	console.log('Running lambda function code..');

	const response = await lambda.discordController(mockDiscordCommand);

	console.log('Lambda function execution finished:', response);

})();
