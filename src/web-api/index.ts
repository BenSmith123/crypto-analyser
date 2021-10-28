
/**
 * Seperate lambda function that uses the same helper functions as the crypto-analyser projects
 * NOTE - this will replace the discord-api
 *
 * API endpoint: https://ffplybtk37.execute-api.ap-southeast-2.amazonaws.com/prod
 *
 * Note: the above API is cross-origin restricted to cryptobot.nz
 */

/* eslint-disable global-require */

import * as express from 'express';
import { getTransactions } from '../database';
import { UserConfiguration } from './types';
import getUserSession from './user';

const cors = require('cors');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

const userDiscordMap = require('./user-discord-map');
const { loadInvestmentConfig, updateInvestmentConfig } = require('../database');


const app = express();

app.use(cors({
	// origin: ['https://www.section.io', 'https://www.google.com/'],
	origin: '*',
}));

app.use(bodyParser.json({ strict: false }));


app.get('/', (req: express.Request, res: express.Response) => res.send('Hello World!'));


app.get('/changelog', (req: express.Request, res: express.Response) => {
	const changelog = require('../data/changelog.json');
	return res.json(changelog);
});


app.get('/commands', (req: express.Request, res: express.Response) => {
	const commands = require('../data/discordCommands.json');
	return res.json(commands);
});


app.get('/currencies', (req: express.Request, res: express.Response) => {
	const supportedCurrencies = require('../data/decimalValueMap.json');
	return res.json(supportedCurrencies);
});

app.get('/user/transactions', async (req: express.Request, res: express.Response) => {

	const accessToken: any = req.headers.accesstoken; // eslint-disable-line
	const allItems: boolean = req.headers.allItems === 'true';

	if (!accessToken) {
		return res.status(400).json({ message: 'No user token provided' });
	}

	const userSession = await getUserSession(accessToken);
	const webUserId: string = userSession?.Username;

	if (!webUserId) {
		return res.status(400).json({ message: userSession.message || 'Authentication error' });
	}

	const discordId: string = userDiscordMap[webUserId];

	const transactions = await getTransactions(discordId || webUserId, allItems);

	return res.json({ transactions });
});


app.get('/user/configuration', async (req: express.Request, res: express.Response) => {

	const accessToken: any = req.headers.accesstoken; // eslint-disable-line

	if (!accessToken) {
		return res.status(400).json({ message: 'No user token provided' });
	}

	const userSession = await getUserSession(accessToken);
	const webUserId: string = userSession?.Username;

	if (!webUserId) {
		return res.status(400).json({ message: userSession.message || 'Authentication error' });
	}

	const discordId: string = userDiscordMap[webUserId];

	try {
		const userConfiguration: UserConfiguration = await loadInvestmentConfig(discordId || webUserId);
		return res.json(userConfiguration);
	} catch (err) {
		return res.status(500).json({ message: `Error loading user config: ${err.message}` });
	}

});


app.post('/user/configuration', async (req: express.Request, res: express.Response) => {

	const accessToken: any = req.headers.accesstoken; // eslint-disable-line
	const updatedConfig = req.body;

	if (!accessToken) {
		return res.status(400).json({ message: 'No user token provided' });
	}

	const userSession = await getUserSession(accessToken);
	const webUserId: string = userSession?.Username;

	if (!webUserId) {
		return res.status(400).json({ message: userSession.message || 'Authentication error' });
	}

	const discordId: string = userDiscordMap[webUserId];

	// if no discord ID, check that the web ID in the token matches the ID in config
	if (!discordId && webUserId !== updatedConfig.id) {
		// this avoids user configs being overwritten by another user
		return res.status(400).json({ message: 'Authentication error - ID mismatch' });
	}

	try {
		const userConfiguration: UserConfiguration = await updateInvestmentConfig(updatedConfig);
		return res.json(userConfiguration);
	} catch (err) {
		return res.status(500).json({ message: `Error loading user config: ${err.message}` });
	}

});


module.exports.webController = serverless(app);
