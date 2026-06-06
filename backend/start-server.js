const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

console.log('Starting LIMS Backend...');

try {
  const db = require('./src/database');
  console.log('Database module loaded');
  
  const routes = require('./src/routes');
  console.log('Routes module loaded');

  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    db.get('SELECT 1 as ok', (err, row) => {
      if (err) {
        return res.status(503).json({ status: 'unhealthy', database: 'error', error: err.message });
      }
      res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    });
  });

  app.use('/api', routes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  app.listen(PORT, () => {
    console.log(`LIMS Backend running on port ${PORT}`);
    db.initDatabase();
    console.log('Database initialized');
    console.log('Server is ready!');
  });

  module.exports = app;
} catch (err) {
  console.error('Startup error:', err);
  process.exit(1);
}
