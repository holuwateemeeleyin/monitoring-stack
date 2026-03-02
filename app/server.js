const express = require('express');
const promClient = require('prom-client');
const app = express();
const port = process.env.PORT || 8080;

// Enable default metrics collection (CPU, Memory, Event Loop Lag, etc.)
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'node_app_' });

// Create a custom metric for HTTP request duration
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in microseconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Create a custom metric for business logic (e.g., user signups)
const userSignupsTotal = new promClient.Counter({
  name: 'app_user_signups_total',
  help: 'Total number of user signups'
});

const userSignupFailuresTotal = new promClient.Counter({
  name: 'app_user_signup_failures_total',
  help: 'Total number of failed user signups'
});

// Middleware to measure request duration
app.use((req, res, next) => {
  const startEpoch = Date.now();
  res.on('finish', () => {
    const responseTimeInMs = Date.now() - startEpoch;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route ? req.route.path : req.path, res.statusCode)
      .observe(responseTimeInMs / 1000);
  });
  next();
});

// Main Route
app.get('/', (req, res) => {
  res.send('Welcome to the Sample Web Application!');
});

// Simulate an API endpoint
app.get('/api/data', (req, res) => {
  // Simulate some latency
  setTimeout(() => {
    res.json({ data: 'Some important data', timestamp: Date.now() });
  }, Math.random() * 500); 
});

// Simulate a business logic endpoint (Signup)
app.post('/api/signup', (req, res) => {
  const success = Math.random() > 0.2; // 80% success rate

  setTimeout(() => {
    if (success) {
      userSignupsTotal.inc();
      res.status(201).json({ message: 'Signup successful!' });
    } else {
      userSignupFailuresTotal.inc();
      res.status(400).json({ error: 'Signup failed!' });
    }
  }, Math.random() * 1000); // Between 0-1s latency
});


// Metrics Endpoint for Prometheus to scrape
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    const metrics = await promClient.register.metrics();
    res.end(metrics);
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
