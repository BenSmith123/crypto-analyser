
echo "Uploading code to lambda...";

# upload the zip file to lambda
aws lambda update-function-code \
	--function-name crypto-analyser \
	--zip-file fileb://dist/lambda.zip \
	--profile bensmith;

echo "Done!";
