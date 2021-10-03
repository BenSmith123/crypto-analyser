
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
