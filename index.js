// For local development testing
if (!process.env.NODE_ENV) require('./.env');
var http = require('http');
var mongoose = require('mongoose');
var config = require('./config');

// Initialize database connection - throws if database connection can't be 
// established
mongoose.Promise = global.Promise;
// mongoose.connect(config.mongoUrl);
// Using `mongoose.connect`...
var promise = mongoose.connect(config.mongoUrl, {
  useMongoClient: true,
  /* other options */
});

// Create Express web app
var app = require('./webapp');

// Create an HTTP server and listen on the configured port
var server = http.createServer(app);
server.listen(config.port, function() {
    console.log('Express server listening on *:' + config.port);
});
