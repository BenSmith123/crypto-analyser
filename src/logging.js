
// TODO - is this needed?

const LOGS = [];

/**
 * @param {string} msg
 */
const log = msg => { LOGS.push(msg); };

/**
 * @returns {array}
 */
const getLogs = () => LOGS;

module.exports = {
	log,
	getLogs,
};
