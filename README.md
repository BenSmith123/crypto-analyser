
### TODO
- Create wrapper code to invoke lambda function and feed it crypto data - check outputs
- Set up in AWS lambda
    - Need to set up trigger
    - Need lambda deploy script - don't forget env vars


### Usage
- Add the name of the desired crypto currency you're wanting to trade in/out to the 'currenciesTargeted' list in the database
    - You can ensure you have the correct coin name by hitting this: https://api.crypto.com/v2/public/get-ticker?instrument_name={COIN_NAME}_USDT
- This will buy the crypto at the market price when there is USDT in your account
- TODO ..

### Reminders
- It's safe to make this repo public when you need, keys and temp data aren't committed!

### Resources
- Crypto.com API docs: https://exchange-docs.crypto.com/spot/index.html
- Big code comment generator: https://ascii.today/
