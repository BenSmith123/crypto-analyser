
# typescript compile code to /dist folder
echo -n "Compiling typescript files";
tsc

echo "Installing packages";
cp package.json "./dist/";
cd dist;
npm install --production; # prod install - don't include dev deps

### Copying node_modules takes longer than just doing a fresh install..
# echo "Copying node_modules into /dist folder"
# mkdir -p dist/node_modules
# cp -r ./node_modules/* ./dist/node_modules; # copy all code in src

echo "Zipping files"

zip -r lambda.zip ./*;

echo "Distribution .zip created: ./dist/lambda.zip!";
