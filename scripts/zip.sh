
# zips the src/ folder, node_modules and package/package-lock files

zip -r ./lambda.zip node_modules package.json package-lock.json src;

echo "Files zipped!";
