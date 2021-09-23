
export interface UserConfiguration {
	id: string,
	isPaused: boolean,
	currenciesTargeted: string[],
	records: {
		[key: string]: { // key is crypto currency code e.g. BTC. CRO
			sellPercentage: 5,
			buyPercentage: -5,
			warningPercentage: null | number,
			stopLossPercentage: null | number,
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
