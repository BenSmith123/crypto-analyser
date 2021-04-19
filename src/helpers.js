
const { writeFileSync } = require('fs');

const calculateDiffPerc = (a, b) => 100 * ((a - b) / ((a + b) / 2));

/**
 * @param {object} data
 * @param {string=} fileName - optional
 */
const saveJsonFile = (data, fileName) => {
	writeFileSync('z-temp.json' || fileName, JSON.stringify(data, null, 2));
};


module.exports = {
	calculateDiffPerc,
	saveJsonFile,
};
