var pages = require('./pages');
var message = require('./message');
var Subscriber = require('../models/Subscriber');
var config = require('../config');
var client = require('twilio')(config.accountSid, config.authToken);
var stripe = require("stripe")("sk_test_yfL2bu7haH59lplWhgjvJm9H");
var plaid = require('plaid');
var plaidClient = new plaid.Client(config.plaidClientID, config.plaidSecret, plaid.environments.tartan);


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
				res.status(500);
			} else {
				res.render('signup');
			}
		});
	});

	app.get('/connect', function(req, res) {
		Subscriber.findById(req.query.id, function(err, sub) {
			if (err || sub === 'undefined' || !req.query.id) {
				res.status(500);
			} else {
				res.render('connect');
			}
		});
	});

	// app.get('/subscriber/:id', function(req, res) {
	// 	Subscriber.findById(req.params.id, function(err, sub) {
	// 		res.send(sub);
	// 	});
	// });

	// Handle form submission and send messages to subscribers
	app.post('/message/send', message.sendMessages);


	// authenticate accepts the public_token from Link
	app.post('/authenticate', function(req, res) {
	  var public_token = req.body.public_token;
	  console.log(req.body);

	  Subscriber.findById(req.body.id, function(err, sub) {
			if (err || !sub) {
				return res.send('Derp! Please text back again later.');
			} else {
				// Exchange a public_token for a Plaid access_token
				plaidClient.exchangeToken(public_token, function(err, res) {
					if (err != null) {
				      // Handle error!
				      return res.send('Error');
				    } else {
					    // This is your Plaid access token - store somewhere persistent
					    // The access_token can be used to make Plaid API calls to
					    // retrieve accounts and transaction
					    sub.plaid.access_token = res.access_token;
					    sub.save();

					    plaidClient.getAuthUser(res.access_token, function(err, authRes) {
					        if (err != null) {
					          // Handle error!
					        } else {
					          // An array of accounts for this user, containing account
					          // names, balances, and account and routing numbers.
					          sub.plaid.accounts = authRes.accounts;
					          sub.save();

					          // Return account data
					          // res.json({accounts: accounts});
					        }
					    });

					    plaidClient.getConnectUser(res.access_token, {
						}, function(err, response) {
							sub.plaid.transactions = response.transactions;
							sub.save();
						});

						var healthTransactions = [];
						var healthTransactionsSum = 0;

						sub.plaid.transactions.forEach(function(transaction) {
							if(transaction.category_id >= 14000000 && transaction.category_id <= 14002020){
								healthTransactions.push(transaction);
								healthTransactionsSum += transaction.amount;
							}
							console.log(transaction.category_id);
						});

						console.log(healthTransactions);
						console.log(healthTransactionsSum);


					    //return message to user confirming connections
						// client.sendMessage({
						// 	to: sub.phone,
						// 	from: config.twilioNumber,
						// 	body: 'Your account is connected. Let me take a look if there are any eligible health transactions.'
						// });

				    }
				});
			}

			 res.send('Updated! Look for a message from us shortly. If your phone number is not, ' + sub.phone + ', contact us immediately.');
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