
# creates a /dist folder and copies the package.json and all scr/ files
# runs a production npm install
# zips the /dist folder

mkdir -p "./dist/src";
cp package.json "./dist/";
cp -r ./src/* ./dist/src; # copy all code in src
cd dist;
npm install --production; # prod install - don't include dev deps

zip -r lambda.zip ./*

echo "Distribution .zip created in ./dist/lambda.zip!";
