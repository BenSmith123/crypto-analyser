
# Configures a lambda function with the default settings (timeout, env vars, handler, role etc.)
# NOTE: This clears any existing environment variables

environmentVars=`cat scripts/environmentVariables.txt`;

aws lambda update-function-configuration \
	--function-name $1 \
	--environment "Variables={$environmentVars}" \
	--timeout 15 \
	--role "arn:aws:iam::793861092533:role/service-role/crypto-analyser-role-s1lfz2yi" \
	--handler src/index.main \
	--profile bensmith

echo "Done!"
