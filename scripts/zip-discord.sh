
# creates a /dist folder and copies the package.json and all scr/ files
# runs a production npm install
# zips the /dist folder

mkdir -p "./dist";
cp package.json "./dist/";
cp -r ./discord-api/* ./dist; # copy all code to dist
cd dist;
npm install --production; # prod install - don't include dev deps

zip -r lambda.zip ./*

echo "Distribution .zip created in ./dist/lambda.zip!";
