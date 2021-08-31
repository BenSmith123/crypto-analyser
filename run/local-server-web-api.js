
const http = require('http');
const url = require('url');

/**
 * This sets up a server to listen to requests and pass the requests to the
 * lambda function in the same format that cloudfront/API gateway would.
 *
 * This does not invoke the lambda function and pass in a preconfigured object,
 * this invokes the lambda function based on an incoming request.
 */

const PORT = 3000;

const lambda = require('../dist/web-api/index');

http.createServer(async (req, res) => {

	if (req.url === '/favicon.ico') { return; }

	// look at the incoming request object and format to how lambda would interpret the incoming event
	const event = {
		body: req.body || null,
		domain: req.domain,
		headers: req.headers,
		httpMethod: req.method,
		path: req.url,
		// endpoint can only be configured via API gateway
		// API gateway can map keys to values from a path: /users/{userId}
		pathParameters: { endpoint: null },
		queryStringParameters: url.parse(req.url, true).query,
	};

	// extract path parameter - e.g: [GET] localhost:3000/blabla
	if (event.path.indexOf('?') !== -1) {
		event.pathParameters.proxy = event.path.slice(1, event.path.indexOf('?')); // remove trailing query string params
	} else {
		event.pathParameters.proxy = event.path.slice(1, event.path.length + 1);
	}

	const lambdaResponse = await lambda.webController(event);

	if (!isValidResponse(lambdaResponse)) {
		internalErrorResponse(res);
	}

	// write default success header
	res.writeHead(lambdaResponse.statusCode, lambdaResponse.headers);
	res.end(lambdaResponse.body);

}).listen(PORT);

// NOTE - this can be expanded based on what data & types that
// lambda will deem invalid as a lambda function response
function isValidResponse(res) {
	return (res.statusCode && res.body && res.headers);
}

// simulate a generic lambda function 502 internal error if the response wasn't valid
function internalErrorResponse(res) {
	res.writeHead(502, { contentType: 'application/json; charset=utf-8' });
	res.end(JSON.stringify({ message: 'Internal server error' }));
}

console.log(`[READY] lambda server running on localhost:${PORT}`);
