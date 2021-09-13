
/**
 * Seperate lambda function that uses the same helper functions as the crypto-analyser projects
 * NOTE - this will replace the discord-api
 *
 * API endpoint: https://ffplybtk37.execute-api.ap-southeast-2.amazonaws.com/prod
 *
 * Note: the above API is cross-origin restricted to cryptobot.nz
 */

const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');

const { getUserConfiguration } = require('../database');


const app = express();

app.use(bodyParser.json({ strict: false }));


app.get('/', (req: any, res: any) => {
	console.log('request came in');
	return res.send('Hello World!');
});

app.get('/changelog', (req: any, res: any) => {
	const changelog = require('../data/changelog.json'); // eslint-disable-line global-require
	return res.json(changelog);
});

app.get('/commands', (req: any, res: any) => {
	const commands = require('../data/discordCommands.json'); // eslint-disable-line global-require
	return res.json(commands);
});

app.get('/available-crypto', (req: any, res: any) => {
	const supportedCurrencies = require('../data/decimalValueMap.json'); // eslint-disable-line global-require
	return res.json(supportedCurrencies);
});

app.get('/user/configuration', (req: any, res: any) => {

	// TODO - get access token from headers
	const { accessToken } = req.query;

	if (!accessToken) {
		return res.status(400).json({ message: 'No user token provided' });
	}

	// TODO - use cognito to user data and confirm user is valid
	return res.status(404).json({ message: 'User ID not found' });

	// TODO - get user configuration from database
	// return loadInvestmentConfig(userId);
});

module.exports.webController = serverless(app);
