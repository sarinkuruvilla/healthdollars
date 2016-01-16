var pages = require('./pages');
var message = require('./message');
var Subscriber = require('../models/Subscriber');
var config = require('../config');
var client = require('twilio')(config.accountSid, config.authToken);
var stripe = require("stripe")("sk_test_bbKyV8oeeRwDL3fmrVb8UIkL");


// Map routes to controller functions
module.exports = function(app) {
	// Twilio SMS webhook route
	app.post('/message', message.webhook);

	// Render a page that will allow an administrator to send out a message
	// to all subscribers
	app.get('/', pages.showForm);

	// Render a page that will allow a subscriber to add payment
	app.get('/signup', function(req, res) {
		Subscriber.findById(req.query.id, function(err, sub) {
			if (err || sub === 'undefined') {
				res.send.status(500);
			} else {
				res.render('signup');
			}
		});
	});

	app.get('/connect', function(req, res) {
		// Subscriber.findById(req.query.id, function(err, sub) {
		// 	if (err || sub === 'undefined') {
		// 		res.send.status(500);
		// 	} else {
				res.render('connect');
		// 	}
		// });
	});

	// app.get('/subscriber/:id', function(req, res) {
	// 	Subscriber.findById(req.params.id, function(err, sub) {
	// 		res.send(sub);
	// 	});
	// });

	// Handle form submission and send messages to subscribers
	app.post('/message/send', message.sendMessages);

	var plaid = require('plaid');
	var plaidClient = new plaid.Client(config.plaidClientID, config.plaidSecret, plaid.environments.tartan);

	// authenticate accepts the public_token and account_id from Link
	app.post('/authenticate', function(req, res) {
	  var public_token = req.body.public_token;
	  var account_id = req.body.account_id;

	  // Exchange a public_token and account_id for a Plaid access_token
	  // and a Stripe bank account token
	  plaidClient.exchangeToken(public_token, account_id, function(err, res) {
	    if (err != null) {
	      // Handle error!
	    } else {
	      // This is your Plaid access token - store somewhere persistent
	      // The access_token can be used to make Plaid API calls to
	      // retrieve accounts and transactions
	      var access_token = res.access_token;

	      // This is your Stripe bank account token - store somewhere
	      // persistent. The token can be used to move money via
	      // Stripe's ACH API.
	      var bank_account_token = res.stripe_bank_account_token;
	    }
	  });
	});

	app.get('/stripe', function(req, res) {
		res.send("Scram!");
	});

	// Handle Stripe form submissions
	app.post('/stripe', function(req, res) {

		Subscriber.findById(req.body.id, function(err, sub) {
			if (err || !sub) {
				return res.send('Derp! Please text back again later.');
			} else {

				sub.stripe = req.body;
				stripe.customers.create({
					source: sub.stripe.stripeToken,
					description: 'Getting customer ID'
				}).then(function(customer) {
					sub.stripe.customerId = customer.id;
					delete sub.stripe.stripeToken;
					delete sub.stripe.id;
					sub.save();
				});

				client.sendMessage({
					to: sub.phone,
					from: config.twilioNumber,
					body: 'Thank you for adding your info ' + sub.stripe.stripeShippingName + '! To continue purchase reply \'BUY\' again.'
				});
			}

			res.send('Updated! Look for a message from us shortly. If your phone number is not, ' + sub.phone + ', contact us immediately.');
		});
	});
};