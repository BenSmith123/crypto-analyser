
# typescript compile code to /dist folder
tsc

cd dist;
npm install --production; # prod install - don't include dev deps

zip -r lambda.zip ./*

echo "Distribution .zip created in ./dist/lambda.zip!";
