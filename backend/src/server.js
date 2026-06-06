const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

let databaseReady = false;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  if (!databaseReady) {
    return res.status(503).json({ 
      status: 'unhealthy', 
      database: 'not_ready', 
      message: 'Database initialization in progress',
      timestamp: new Date().toISOString() 
    });
  }
  
  db.get('SELECT 1 as ok')
    .then(() => {
      res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    })
    .catch((err) => {
      res.status(503).json({ status: 'unhealthy', database: 'error', error: err.message });
    });
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`LIMS Backend starting on port ${PORT}, initializing database...`);
  
  setTimeout(() => {
    db.initDatabase();
    databaseReady = true;
    console.log(`LIMS Backend running on port ${PORT}, database ready`);
  }, 3000);
});

module.exports = app;
