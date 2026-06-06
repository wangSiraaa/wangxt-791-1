
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('../src/database');
const routes = require('../src/routes');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (req, res) => {
  db.get('SELECT 1 as ok', (err, row) => {
    if (err) return res.status(503).json({ status: 'unhealthy' });
    res.json({ status: 'healthy', database: 'ok' });
  });
});

app.use('/api', routes);

app.listen(3099, () => {
  db.initDatabase();
  console.log('TEST_SERVER_READY');
});
