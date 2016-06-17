var request 			= require('request');
var async 				= require("async");
var fs 					= require('fs');
var util 				= require('util');
var nodemailer 			= require('nodemailer');
var smtpTransport 		= require('nodemailer-smtp-transport');
var jade 				= require('jade');

var timers 				= {};
var API_STATUS_AVAILABLE 	  = ' Available ';
var API_STATUS_UNKNOWN	 	  = ' Unknown ';
var API_STATUS_DOWN	 	      = ' Down ';

function monitor(req, res){
	try {
		var envFromParam = typeof req.query.env != 'undefined' ? req.query.env : 'development';
		if (envFromParam !== 'development' && 
			envFromParam !== 'qa'	&&
			envFromParam !== 'stage' &&
			envFromParam !== 'production') {
			console.log(new Date().toString() + " - " +
					'Valid environment paraameter values are development, qa, stage or production.');
			res.send(new Date().toString() + " - " +
					'Valid environment paraameter values are development, qa, stage or production.');
			return new Error('Invalid environment parameter passed.');	
		}
		var pollingInterval			  = typeof req.query.interval != 'undefined' ? parseInt(req.query.interval) : 1;
		var configjson 	= require('../config.json')[envFromParam];

		if (req.path === '/monitor/start') {
			if (!timers[envFromParam]) {
				console.log(new Date().toString() + " - " +
						'Starting Monitor Agent in ' + envFromParam +
						" environment which will run every " + pollingInterval + ' minutes. Request received from ' + JSON.stringify(req.headers) + "\n" +
						'Go to http://' + req.headers.host  + '/monitor/stop?env=' + envFromParam + ' to stop monitoring.');
				
				timers[envFromParam] = setInterval(function() {
					pollAPIs(configjson, envFromParam, req, res, function(apiResults){ 
						//console.log("Results = " + util.inspect(apiResults));
						if (isAPIDown(apiResults)) {
							console.log (new Date().toString() + "**** API/s down in " + envFromParam + " - " + "Sending email alert...");
							var html 		= prepareEmail(apiResults, envFromParam);
							email(configjson.email_to, html);
						}						
					});
				}, pollingInterval*60000);	
				
				res.send('Starting Monitor Agent in ' + envFromParam +
						" environment which will run every " + pollingInterval + ' minutes. Request received from ' + JSON.stringify(req.headers) + "\n" +
						'Go to http://' + req.headers.host  + '/monitor/stop?env=' + envFromParam + ' to stop monitoring.');
				
			} else {
				console.log(new Date().toString() + " - " +
						'Request denied. Monitoring for ' + req.query.env + ' is already running. ');
				res.send(new Date().toString() + " - " +
						'Request denied. Monitoring for ' + req.query.env + ' is already running. ');
			}
		}
		
		else if (req.path === '/monitor/stop') {
			console.log(new Date().toString() + " - " + 'Stopping Monitor Agent in ' + envFromParam + " environment.");
			clearTimeout(timers[envFromParam]);
			delete timers[envFromParam];
			console.log(new Date().toString() + " - " + "Monitor Agent has stopped polling APIs in "  + envFromParam + " environment.");
			res.send(new Date().toString() + " - " + "Monitor Agent has stopped polling APIs in "  + envFromParam + " environment. \n");
			
		} else 	if (req.path === '/monitor/dashboard') {
			pollAPIs(configjson, envFromParam, req, res, function(apiResults){ 
				console.log(new Date().toString() + " - " + 'Sending dashboard response for ' + envFromParam + " environment...");				
				var dashboardHtml	= prepareEmail(apiResults, envFromParam);
				res.send(dashboardHtml);					
			});
		}
	} catch (err) {
		console.log('Error caught in function monitor() - ' + err);
	}
};

module.exports = monitor;

function pollAPIs(configjson, envFromParam, req, res, pollingresults) {
	console.log(new Date().toString() + " - " + "Monitor Agent is now polling APIs in " + envFromParam);
	var response_length_to_output = 150; //limits the length of response sent out

	function Result() {
		this.url 					= '';
		this.api_call_status 		= '';
		this.error_msg 				= '';
		this.response_time 			= '';
		this.response_status_code 	= '';
		this.response_body			= '';
	}
	Result.prototype.toString = function() {
		return this.url + ' ' +
		this.api_call_status + ' ' +
		this.error_msg + ' ' +
		this.response_time + ' ' +
		this.response_status_code + ' ';
	};
	var results = new Array();

	async.forEachOf(configjson.apis, function (value, i, callback) {
		var postPutBody = '';
		if (typeof value.http_post_put_body !== 'undefined') {
			postPutBody =	JSON.parse(fs.readFileSync(__dirname + value.http_post_put_body, 'utf8'));
		};
		var options = {
				url: 		value.url,
				headers: 	value.http_headers,
				timeout: 	configjson.timeout,
				time: 		configjson.captureResponseTime,
				host: 		value.host,
				method: 	value.http_method,
				json: 		postPutBody,
				auth:		value.auth
		};

		request(options, function (error, response, body) {
			try {
				var api_call_status = '';
				var error_msg 		= '';
				var response_time 	= 'N/A';
				if (error) {
					api_call_status = API_STATUS_DOWN;
					if (error.code == 'ETIMEDOUT') {
						error_msg = error.connect === true ? "Connection timeout in " : "Read timeout in ";
						error_msg += options.timeout + 'ms.';
					} else if (error.code == 'ENOTFOUND') {
						error_msg = options.host + ' is unreachable from ' + req.headers.host;
					}
					error_msg += ' Server response is ' + error;
				}
				if (!error && response.statusCode == 200) {
					api_call_status = API_STATUS_AVAILABLE;
					response_time = response.elapsedTime;
					error_msg = typeof body != 'undefined' ? JSON.stringify(body).substring(1,response_length_to_output) : 'N/A';
				} else
					if (!error && response.statusCode == 403) {
						api_call_status = API_STATUS_AVAILABLE;
						response_time = response.elapsedTime;
						error_msg = typeof body != 'undefined' ? JSON.stringify(body).substring(1,response_length_to_output) : 'N/A';
					} else
						if (!error && (response.statusCode == 401 || response.statusCode == 404 || response.statusCode == 400 || response.statusCode == 405)) {
							api_call_status = API_STATUS_UNKNOWN;
							response_time = response.elapsedTime;
							error_msg = typeof body != 'undefined' ? JSON.stringify(body).substring(1,response_length_to_output) : 'N/A';
							if (error_msg.indexOf('confirmMessage') > -1) {
								api_call_status = API_STATUS_AVAILABLE;
							}
						} else
							if (!error && response.statusCode == 500) {
								api_call_status = API_STATUS_DOWN;
								response_time = response.elapsedTime;
								error_msg = typeof body != 'undefined' ? JSON.stringify(body) : 'N/A';
							}

				var result 				= new Result();
				result.method			= options.method;
				result.url 				= options.url;
				result.api_call_status 	= api_call_status;
				result.error_msg 		= error_msg;
				result.response_time 	= response_time;
				result.response_status_code = typeof response != 'undefined' ? response.statusCode : 'N/A';
				results.push(result);
			} catch (e) {
				console.error('Error caught in request ' + e);
				return callback(e);
			}
			callback();
		});
	}, function (err) {
		if (err) console.error('Error caught in async.forEachOf ' + err);
		pollingresults(results);
	}) //async.forEachOf
}

function isAPIDown(results) {
	var returnFlag = false;
	for (var i in results) {
		returnFlag = returnFlag ||
					results[i].api_call_status == API_STATUS_DOWN ||
					results[i].api_call_status == API_STATUS_UNKNOWN;
	}
	return returnFlag;
}

function prepareEmail(results, envFromParam) {
	try {
		var fn = jade.compileFile('./views/apihealthcheck.jade');
		var htmlOutput = fn({'results':results,
							'title':'API Healthcheck Report',
							'environment':envFromParam.toUpperCase()});
		return htmlOutput;
	} catch(e) {
		console.log('Error caught in prepareEmail ' + e);
	}
}

function email(to, body) {
	console.log('Sending Email...');
	try {

		var transporter = nodemailer.createTransport(smtpTransport({
			host: '<SMTP Host Name>',
			port: 25,
			auth: false
		}));

		transporter.sendMail({
			from: 'apimonitor-no-reply@gmail.com',
			to: to,
			subject: 'Important: API Healthcheck alert',
			html: body
		});
	} catch(e) {
		console.log('Error caught in email ' + e);
	}
}