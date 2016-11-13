// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');

var databaseUri = 'mongodb://admin:password@ec2-52-221-226-199.ap-southeast-1.compute.amazonaws.com/parsedb';

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var pushConfig =  { pushTypes : { android: {ARN : 'arn:aws:sns:ap-southeast-1:422730382130:app/GCM/signalheart'},
                   senderId: '155059185604',
                   apiKey: 'AIzaSyDMEtG-JEyBPnGsvEihEXih0cVYlmMLMsc'},
                   accessKey: 'AKIAIS467O2EUMNWFSGA',
                   secretKey: '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',
                   region: "ap-southeast-1"
                 };

var SNSPushAdapter = require('parse-server-sns-adapter');
var snsPushAdapter = new SNSPushAdapter(pushConfig);
pushConfig['adapter'] = snsPushAdapter;

var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'cpX2tTZezdrl4eyBmO430g2Jl27TeuMljfpGa81E',
  masterKey: process.env.MASTER_KEY || 'EGoZo0sZZ1QLCg1a5boiPWfhlSKs0u8NKrKLlxTH', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://eb-dev.ap-southeast-1.elasticbeanstalk.com/parse',  // Don't forget to change to https if needed
  // liveQuery: {
  //   classNames: ["Secret", "Comment"] // List of classes to support for query subscriptions
  // },
  push: {pushConfig}
  
});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey
 
var app = express();

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
