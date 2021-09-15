
// eslint-disable-next-line import/no-extraneous-dependencies
const { CognitoIdentityServiceProvider } = require('aws-sdk'); // lambda runtime has aws-sdk installed

const cognito = new CognitoIdentityServiceProvider({ region: 'ap-southeast-2' });

// eslint-disable-next-line import/prefer-default-export
export const getUserSession = async (AccessToken: string): Promise<Record<string, string>> => {
	try {
		return await cognito.getUser({ AccessToken }).promise();
	} catch (err) {
		console.error(err); // TODO?
		return err;
	}
};
