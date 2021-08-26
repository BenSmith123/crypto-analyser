
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express')
const app = express()

app.use(bodyParser.json({ strict: false }));

app.get('/', function (req: any, res: any) {
  res.send('Hello World!')
})

module.exports.webController = serverless(app);
