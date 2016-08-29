require('any-promise/register')('bluebird', {Promise: require('bluebird')});
var _ = require('lodash');
var moment = require('moment');
var doc = require('dynamodb-doc');
var dynamo = new doc.DynamoDB();
var Promise = require('any-promise');
var google = require('googleapis');
var calendar = google.calendar('v3');
var OAuth2 = google.auth.OAuth2;

exports.handler = function (event, context) {
    function getGoogleCredentials() {
        var params = {
            Key: {
                key: 'googleapi'
            },
            TableName: 'home-integration'
        };

        return new Promise(function(resolve, reject) {
            dynamo.getItem(params, function(err, data) {
                if(err) {
                    reject(err);
                }
                else {
                    resolve(data.Item);
                }
            });
        });
    }

    getGoogleCredentials().then(function(data) {
        var CLIENT_ID = data.client_id;
        var CLIENT_SECRET = data.client_secret;
        var REDIRECT_URL = data.redirect_url;

        var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

        oauth2Client.setCredentials({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_type: data.token_type,
          expiry_date: data.expiry_date
        });

        calendar.events.list({
            auth: oauth2Client,
            calendarId: data.calendar_id,
            timeMin: (new Date()).toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime'
        }, function(err, response) {
            if (err) {
                console.log('The API returned an error: ' + err);
                context.fail(err);
            }

            var events = _.filter(response.items, function(item) {
                return item.summary.startsWith(data.filter_term);
            });

            console.log(events[0]);
            console.log(_.map(events, function(item) { return [item.summary, moment(item.start.dateTime).format(data.date_format)];}));
            context.done();
        });
    });
};