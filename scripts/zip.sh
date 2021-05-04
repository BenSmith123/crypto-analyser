
# creates a /dist folder and copies the package.json and all scr/ files
# runs a production npm install
# zips the /dist folder

mkdir -p "./dist/src";
cp package.json "./dist/";
cp ./src/* ./dist/src; # copy all code in src
cd dist;
npm install --production; # prod install - don't include dev deps

cd ..;

zip -r ./dist/lambda.zip ./dist;

echo "Distribution .zip created in ./dist/lambda.zip!";
