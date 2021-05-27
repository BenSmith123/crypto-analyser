#!/bin/bash

lambdaFunctions=("crypto-analyser" "crypto-analyser-z" "crypto-analyser-jett")

for lambdaFunc in "${lambdaFunctions[@]}"

do
    echo "Deploying code to $lambdaFunc.."
	# upload the zip file to lambda
	aws lambda update-function-code \
		--function-name $lambdaFunc \
		--zip-file fileb://dist/lambda.zip \
		--profile bensmith;
done

echo "All deployments complete!";
