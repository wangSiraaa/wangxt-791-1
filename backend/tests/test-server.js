const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const database = require('../src/database');
const routes = require('../src/routes');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (req, res) => {
  database.get('SELECT 1 as ok')
    .then(() => res.json({ status: 'healthy', database: 'ok' }))
    .catch((err) => {
      res.status(503).json({ status: 'unhealthy', error: err.message });
    });
});

app.use('/api', routes);

app.listen(3099, () => {
  database.initDatabase();
  console.log('TEST_SERVER_READY');
});
