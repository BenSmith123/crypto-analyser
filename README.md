
# crypto-analyser

## Description

### crypto-bot
- AWS Lambda function crypto-bot code (per user) running on scheduled jobs every 15 minutes.
- The crypto-bot uses the Crypto.com exchange API to monitor and trade cryptocurrency based on a users configuration.
- To use this bot a user must have a Crypto.com exchange account.

### crypto-assistant (discord-api)
- A seperate lambda function API (exposed via API gateway) for updating user crypto-bot configuration
code and can be found in the `/src/discord-api/` folder. This is known as the 'Crypto Assistant' and is 
currently accessable via Discord slash commands.
- This API is also used to service the `cryptobot.nz` website.
- NOTE: This API shares functionality with the crypto-bot code but does not contain any keys and has no
access to any users Crypto.com accounts.


### TODO
- Automation test scenarios mocking a spike and not selling - use this to test newly added RSI
- Incorporate RSI, volume etc. - still to discuss whether or not this is useful
- Add number of transactions? & initial date etc.
- Re-implement the local-analyser.js code in a test/mock framework
- Don't pause the bot on every error - if crypto.com is down, let bot keep running rather than everyone having to unpause manually
- AUTOMATION TEST! 
	- Heaps of errors on the v3 release on the crypto-assistant, lots could've been caught
- Add user details to transactions? Not just their IDs
- Website to show of the bot!
	- Purpose, details, features
	- Lists the commands/has screenshots
	- Has all logic documented
	- Includes changelog
- Convert all outputs from USDT to NZD estimates
- Crypto assistant audit logs - daily/weekly updates on no. of transactions, all filled, money moved etc.
- More coin options:
	- noBuyBack - after selling coin, don't buy back into it and stop monitoring it
- Fix USDT selling in only full dollar amounts
- Make the crypto bot invoke lambda functions based on the user to get crypto-api details (this avoids having auth or storing their crypto-api keys)
- ^ might not be useful if everyone can already see it in their wallet
- Auto limit sell order or stop loss?
- Implement paused 'reason' - Error, manually, bot update etc.
- Icon or emoji for discord bot


### Usage
- Add the name of the desired crypto currency you're wanting to trade in/out to the 'currenciesTargeted' list in the database
    - You can ensure you have the correct coin name by hitting this: https://api.crypto.com/v2/public/get-ticker?instrument_name={COIN_NAME}_USDT
- This will buy the crypto at the market price when there is USDT in your account
- TODO ..


### Setting up new users
- Create new lambda function
- Run `npm run configure <lambda-name>`
- Create a new database record for them in the database (with their `id` being the discord ID)
- Manually enter env vars (discord urls, user_id etc.)
- Add the event bridge trigger
- Deploy code to their lambda function by changing the name in the `deploy.sh` and running `npm run deploy`
- Add their lambda function name to the `deploy-all.sh` for their function to be included in code roll-outs

### Commands
- `npm start`

- `npm test`
	- Mocha run all tests

- `npm run update-currency-map`
	- See `scripts/updateDecimalValueMap.js` description

- `npm run analyse-transactions`
	- Gets all transactions from the database and generates a summary `transactions-summary.json` file

- `npm run deploy` 
	- Copies the package.json and src/ files into a temp `/dist` folder
	- Runs a production install in the temp folder
	- Zips the folder and deploys it to AWS lambda
	- Deletes the temp `/dist` folder

- `npm run deploy-all` 
	- Same as above but deploys to a list of lambda functions

- `npm run configure <lambda-name>`
	- Configures a lambda function with the default settings (timeout, env vars, handler, role etc.)
	- NOTE: This clears any existing environment variables

### Resources
- Discord announcements channel: https://discord.com/api/webhooks/839816114094866463/UYjXAY_evzfnCKohuFNNFnG7IOQlNhigZKvaCZ0juPz0HZSD7MtCptGcVIj1kOhMl7z2
- Discord slash commands guide: https://discord.com/developers/docs/interactions/slash-commands
- Crypto.com exchange: https://crypto.com/exchange
- Crypto.com API docs: https://exchange-docs.crypto.com/spot/index.html
- Big code comment generator: https://ascii.today/
