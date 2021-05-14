
### TODO
- AUDITER lambda or function to watch orders placed and update database config?
- API interface to get data 
	- account data, stats etc.
	- how to deal with auth?
- More coin options:
	- Auto limit sell order or stop loss
	- noBuyBack - after selling coin, don't buy back into it and stop monitoring it
- Fix USDT selling in only full dollar amounts
- Log account currencies every x hours
- Start saving ALL transactions to the database
- Add user crypto.com data to their database config on every transaction!
	- Add slash command to get this ^
- Implement more discord commands!
	- Allow user to set buy/sell percentages
	- Allow user to set targetted currency - must be in the available list
- Trial waiting/confirming transactions?
- Add a second crypto and test - no logic around ratios to split USDT into different coins - if a coin is sold and is now in USDT, 100% of it will go into the next buy
- ^ Add weights to each crypto (percentages of how much USD to spent)
- Change option to just buy at market price when there is no record of it - make it only buy in at a certain %
- Icon or emoji for discord bot
- Compare transaction logs and actual orders-filled and see if there are any discrepencies (https://crypto.com/exchange/wallets/spot/order-history)


### Usage
- Add the name of the desired crypto currency you're wanting to trade in/out to the 'currenciesTargeted' list in the database
    - You can ensure you have the correct coin name by hitting this: https://api.crypto.com/v2/public/get-ticker?instrument_name={COIN_NAME}_USDT
- This will buy the crypto at the market price when there is USDT in your account
- TODO ..


### Setting up new users
- Create new lambda function
- Run `npm run configure <lambda-name>`
- Create a new database record for them in the database
- Add the event bridge trigger

### Commands
- `npm run deploy` 
	- Copies the package.json and src/ files into a temp `/dist` folder
	- Runs a production install in the temp folder
	- Zips the folder and deploys it to AWS lambda
	- Deletes the temp `/dist` folder

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
