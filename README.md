
### TODO
- More coin options:
	- Auto limit sell order or stop loss
	- noBuyBack - after selling coin, don't buy back into it and stop monitoring it
- Fix USDT selling in only full dollar amounts
- Add more user configuration options: Simple logs, disable logs?, 
- Add user crypto.com data to their database config on every transaction!
	- Add slash command to get this ^
- Make the crypto bot invoke lambda functions based on the user to get crypto-api details
- ^ this avoids having auth or storing their crypto-api keys
- Implement /force-buy
- Add a second crypto and test - no logic around ratios to split USDT into different coins - if a coin is sold and is now in USDT, 100% of it will go into the next buy
- ^ Add weights to each crypto (percentages of how much USD to spent)
- Change option to just buy at market price when there is no record of it - make it only buy in at a certain %
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
- `update-currency-map`
	- See `scripts/updateDecimalValueMap.js` description

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

### Reminders
- It's safe to make this repo public when you need, keys and temp data aren't committed!

### Resources
- Discord announcements channel: https://discord.com/api/webhooks/839816114094866463/UYjXAY_evzfnCKohuFNNFnG7IOQlNhigZKvaCZ0juPz0HZSD7MtCptGcVIj1kOhMl7z2
- Discord slash commands guide: https://discord.com/developers/docs/interactions/slash-commands
- Crypto.com exchange: https://crypto.com/exchange
- Crypto.com API docs: https://exchange-docs.crypto.com/spot/index.html
- Big code comment generator: https://ascii.today/
