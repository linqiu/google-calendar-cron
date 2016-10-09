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

    function updateCalendar(data, terms) {
        var params = {
            TableName: 'home-integration',
            Item: {
                key: 'google-calendar',
                data: data,
                terms: terms
            }
        };

        return new Promise(function(resolve, reject){
            dynamo.putItem(params, function(err, data) {
                if(err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    function determineStartTimes(item, summary, startTimes) {
        var actualStartTime = '';

        _.each(startTimes, function(startTime){
            if (summary.includes(startTime.type)) {
                actualStartTime = startTime.regular;

                if (summary.includes('early')) {
                    actualStartTime = startTime.early;
                }

                item.start_time = actualStartTime;
            }
        });
    }

    getGoogleCredentials().then(function(data) {
        var CLIENT_ID = data.client_id;
        var CLIENT_SECRET = data.client_secret;
        var REDIRECT_URL = data.redirect_url;

        var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
        var filterTerm = data.terms.filter;
        var startTimes = data.start_times;

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

            var events = _(response.items).filter(function(item) {
                    return item.summary.startsWith(filterTerm);
                })
                .sortBy(function(item) {
                    var date = item.start.date || item.start.dateTime;
                    return moment(date).unix();
                })
                .map(function(item) {
                    var date = item.start.date || item.start.dateTime;
                    var itemData = {
                        event: item.summary,
                        time: moment(date).format(data.date_format)
                    };

                    determineStartTimes(itemData, item.summary.toLowerCase(), startTimes);

                    return itemData;
                }).value();

            updateCalendar(events, data.terms).then(function() {
                context.done();
            });
        });
    });
};