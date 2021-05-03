
environmentVars="{NODE_ENV=test,DISOCRD=true}";

aws lambda update-function-configuration --function-name crypto-analyser --environment "Variables=$environmentVars" --profile bensmith

echo 'Updated environment vars:'
echo $environmentVars
