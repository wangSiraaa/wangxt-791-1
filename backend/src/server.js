const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./database');
const routes = require('./routes');

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
});

module.exports = app;
