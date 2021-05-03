#!/bin/bash
# zips the src/ folder, node_modules and package/package-lock files and deploys to lambda

lambda_name="crypto-analyser";

zip -r ./lambda.zip node_modules package.json package-lock.json src;

echo files zipped\!;
echo pushing zip to lambda...

# upload the zip file to lambda
aws lambda update-function-code 
    --function-name $lambda_name 
    --zip-file fileb://lambda.zip 
    --profile bensmith;

echo done!