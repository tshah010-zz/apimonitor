
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , monitor = require('./routes/monitoragent.js')  
  , os = require('os')
  , http = require('http')
  , path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));


// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}


app.get('/', routes.index);
app.get('/monitor/*', monitor);


http.createServer(app, function(req, res) {
	res.setHeader('Access-Control-Allow-Headers', req.header.origin);
	}).listen(app.get('port'), function(){
	console.log(new Date().toString() + " - " + 'Monitor Agent initialized on port ' + app.get('port'));
	console.log(new Date().toString() + " - " + 'Go to http://' + os.hostname() + ':' + app.get('port') + "/monitor/start?[env={development|qa|stage|production}[&interval={minutes}]]");	
});
