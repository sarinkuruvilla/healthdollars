var Subscriber = require('../models/Subscriber');
var config = require('../config');
var client = require('twilio')(config.accountSid, config.authToken);
var stripe = require('stripe')("sk_test_bbKyV8oeeRwDL3fmrVb8UIkL");

// Create a function to handle Twilio SMS / MMS webhook requests
exports.webhook = function(request, response) {

    // Get the user's phone number
    var phone = request.body.From;

    // Try to find a subscriber with the given phone number
    Subscriber.findOne({
        phone: phone
    }, function(err, sub) {
        if (err) return respond('Derp! Please text back again later.');

        if (!sub) {
            // If there's no subscriber associated with this phone number,
            // create one
            var newSubscriber = new Subscriber({
                phone: phone
            });

            newSubscriber.save(function(err, newSub) {
                if (err || !newSub)
                    return respond('We couldn\'t sign you up - try again.');

                // We're signed up but not subscribed - prompt to subscribe
                respond('Welcome to HealthDollars, a personal financial assistant to save you money on health care expenses. Get started, reply \'start\' to learn more.');
            });
        } else {
            // For an existing user, process any input message they sent and
            // send back an appropriate message
            processMessage(sub);
        }
    });

    // Process any message the user sent to us
    function processMessage(subscriber) {
        // get the text message command sent by the user
        var msg = request.body.Body || '';
        msg = msg.toLowerCase().trim();

        // Conditional logic to do different things based on the command from
        // the user
        if (msg === 'subscribe' || msg === 'unsubscribe' || msg === 'start') {
            // If the user has elected to subscribe for messages, flip the bit
            // and indicate that they have done so.
            subscriber.subscribed = true;
            subscriber.save(function(err) {
                if (err) {
                    return respond('We could not subscribe you - please try again.');
                }

                // Otherwise, our subscription has been updated
                var responseMessage = 'Thanks for subscribing! Add me to your contacts – I\'ll send you my info.';
                if (!subscriber.subscribed) {
                    responseMessage = 'Subscribing is as simple as replying \'subscribe\'.';
                }

                // Send vcard
                if (!!subscriber.subscribed) {
                    client.sendMessage({
                        to: phone,
                        from: config.twilioNumber,
                        // mediaUrl: 'https://dl.dropboxusercontent.com/u/8725488/TaggistVcard.vcf'
                    }, function(err, response) {
                        if (err) {
                            // Just log it for now
                            console.error(err);
                        } else {
                            // Log the last few digits of a phone number
                            var masked = subscriber.phone.substr(0,
                                subscriber.phone.length - 5);
                            masked += '*****';
                            console.log('Message sent to ' + masked);
                        }
                    });
                }
                respond(responseMessage);
            });
        } else if (msg === 'options' && subscriber.subscribed) {
            var responseMessage = 'Available commands are: unsubscribe. If you unsubscribe by accident just text me \'start\' to resubscribe.';
            respond(responseMessage);

        } else if (msg === 'connect' && subscriber.subscribed && typeof subscriber.stripe === 'undefined') {
            var signupUrl = 'https://healthdollars-sta.herokuapp.com/connect?id=' + subscriber._id
            var responseMessage = 'Update your info to continue: ' + signupUrl;
            respond(responseMessage);

        } else {
            // If we don't recognize the command, text back with the list of
            // available commands
            var responseMessage = 'I don\'t understand that command. ' +
                'Reply \'options\' for more.';
            if (!subscriber.subscribed) {
                responseMessage = 'Hey again! Reply with \'subscribe\' to get started.';
            }

            respond(responseMessage);
        }
    }

    // Set Content-Type response header and render XML (TwiML) response in a 
    // Jade template - sends a text message back to user
    function respond(message) {
        response.type('text/xml');
        response.render('twiml', {
            message: message
        });

    }
};

// Handle form submission
exports.sendMessages = function(request, response) {
    // Get message info from form submission
    var message = request.body.message;
    var imageUrl = request.body.imageUrl;

    // Use model function to send messages to all subscribers
    Subscriber.sendMessage(message, imageUrl, function(err) {
        if (err) {
            request.flash('errors', err.message);
        } else {
            request.flash('successes', 'Messages on their way!');
        }

        response.redirect('/');
    });
};
