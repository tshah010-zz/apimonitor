
Welcome to API Monitor!
===================
The application is a light-weight NodeJS application designed to 

 1. monitor RESTful APIs in any environment - Development, QA, Staging and Production
 2. run monitor in multiple environments simultaneously 
 3. send alerts to the developers APIs are down
 4. easily modify API parameters
 5. easily modify recipient list 
 6. have separate monitoring frequency for each environment (e.g. 1 min for Development and 24 hours for Production)
 7. easily add new environment (e.g. QA2)
 8. monitor POST, PUT and GET requests
 9. dashboard for real-time status in any environment (great for quick check)
 10. easy operation through URI (start, stop, change frequency)
 11. reports if an API timed out
 12. report response time of each API
 13. show snippet of return message



## Usage
#### <i class="icon-file"></i> Setup
Add a valid SMTP host name on line 220 in routes/monitoragent.js. Following setup is required for each API to be monitored:
 1. Define it in 'apis' section in 'config.json'.
 2. If API is a 'POST' then create a new file in 'postsamples' folder and give it .json extension.
 3. Finally, add name of the file created in step 2 to 'http_post_put_body' attribute in appropriate API defined in step 1.

#### <i class="icon-file"></i> View Dashboard
This allows you to see status of APIs in real-time
```
http://host:port/monitor/dashboard?env={development|qa|stage|production}
```

#### <i class="icon-file"></i> Start Monitor in default mode
Start monitoring of development environment every 1 minute
```
http://host:port/monitor/start
```

#### <i class="icon-file"></i> Start Monitor for specific Environment and Interval
```
http://host:port/monitor/start?[env={development|qa|stage|production}[&interval={minutes}]]
```

#### <i class="icon-file"></i> Stop Monitor for specific Environment
```
http://host:port/monitor/stop?[env={development|qa|stage|production}]
```

## Developer
Tushar V. Shah
