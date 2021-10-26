/* eslint-disable camelcase */

export interface UserConfiguration {
	id: string,
	isPaused: boolean,
	currenciesTargeted: string[],
	records: {
		[key: string]: { // key is crypto currency code e.g. BTC. CRO
			lastSellPrice?: number,
			lastBuyPrice?: number,
            orderDate: string,
            timestamp: number,
			isHolding?: boolean,
            forceSell?: boolean,
			forceBuy?: boolean,
			thresholds: {
				sellPercentage: number,
				buyPercentage: number,
				warningPercentage?: null | number,
				stopLossPercentage?: null | number,
			}
		}
	}
	options: {
		simpleLogs: boolean,
	}
	user: {
		displayName: string,
		firstName: string,
	}
}

export interface Transaction {
	status: string,
    timestamp: number,
    user: string,
	order_info: {
		side: 'SELL' | 'BUY',
		cumulative_quantity: number,
        quantity: number,
		create_time: number,
        fee_currency: string,
		avg_price: number,
        exec_inst: 'POST_ONLY' | '',
        client_oid: string,
        type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LIMIT',
        update_time: number,
        time_in_force: 'GOOD_TILL_CANCEL' | 'IMMEDIATE_OR_CANCEL' | 'FILL_OR_KILL',
        instrument_name: string,
        price: number,
        cumulative_value: number,
        order_id: string,
        status: 'ACTIVE' | 'CANCELED' | 'FILLED' | 'REJECTED' | 'EXPIRED'
	},
	trade_list: [
		{
			liquidity_indicator: 'MAKER' | 'TAKER',
            side: 'SELL' | 'BUY',
            trade_id: string,
            create_time: number,
            instrument_name: 'SUSHI_USDT',
            fee: number,
            fee_currency: string,
			traded_quantity: number,
            client_oid: string,
            traded_price: number,
            order_id: string
		}
	]
}

