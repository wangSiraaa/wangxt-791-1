const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3099;
const serverFile = path.join(__dirname, '.test-server.generated.js');

const serverCode = `
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

app.listen(${PORT}, () => {
  database.initDatabase();
  console.log('TEST_SERVER_READY');
});
`;

fs.writeFileSync(serverFile, serverCode);

console.log('Starting test server on port', PORT);

const server = spawn('node', [serverFile], {
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let ready = false;
server.stdout.on('data', (data) => {
  const msg = data.toString();
  if (msg.includes('TEST_SERVER_READY')) {
    ready = true;
    console.log('Server ready, running tests...');
    runTests();
  }
});

server.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

setTimeout(() => {
  if (!ready) {
    console.log('Server timeout');
    cleanup();
    process.exit(1);
  }
}, 10000);

function request(method, path, data = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ error: 'request timeout' });
    });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

let passed = 0, failed = 0;
function test(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log('  PASS:', name);
  } else {
    failed++;
    console.log('  FAIL:', name, detail);
  }
}

async function runTests() {
  console.log('\n--- Test Results ---\n');

  const h = await request('GET', '/health');
  test('Health check works', h.status === 200, `status=${h.status}`);
  test('Database is healthy', h.data?.status === 'healthy', '');

  const order = await request('POST', '/api/commissions', {
    client_name: 'Test Client',
    samples: [{
      sample_name: 'Test Sample',
      storage_condition: '冷藏',
      test_items: [{ item_code: 'T001', item_name: 'Test Item' }]
    }]
  });
  test('Create commission order', order.status === 201, `status=${order.status}`);
  
  const orderId = order.data?.id;
  const vialBarcode = order.data?.order_no ? '' : '';

  if (orderId) {
    const detail = await request('GET', `/api/commissions/${orderId}`);
    test('Get order detail', detail.status === 200, `status=${detail.status}`);
    
    const vialId = detail.data?.vials?.[0]?.id;
    const itemId = detail.data?.testItems?.[0]?.id;
    const barcode = detail.data?.vials?.[0]?.vial_barcode;

    if (itemId) {
      const badAssign = await request('POST', '/api/assignments', {
        item_id: itemId,
        assigner_id: 'a',
        assigner_name: 'A',
        assignee_id: 'b',
        assignee_name: 'B'
      });
      test('RULE: Cannot assign before sample received', 
        badAssign.status === 400, 
        `status=${badAssign.status}, expected 400`);
      console.log('       Server response:', JSON.stringify(badAssign.data).substring(0, 100));
    }

    if (barcode) {
      const abnormal = await request('POST', '/api/samples/receive', {
        vial_barcode: barcode,
        receiver_id: 'r',
        receiver_name: 'R',
        condition_check_passed: false,
        is_abnormal: true,
        abnormal_reason: 'Test abnormal'
      });
      test('Abnormal sample receipt', abnormal.status === 200, `status=${abnormal.status}`);
      test('Sample status becomes ABNORMAL', 
        abnormal.data?.vial?.status === 'ABNORMAL',
        `status=${abnormal.data?.vial?.status}`);
      console.log('       Sample status after receipt:', abnormal.data?.vial?.status);

      if (itemId) {
        const abnormalAssign = await request('POST', '/api/assignments', {
          item_id: itemId,
          assigner_id: 'a',
          assigner_name: 'A',
          assignee_id: 'b',
          assignee_name: 'B'
        });
        test('RULE: Cannot assign abnormal sample', 
          abnormalAssign.status === 400,
          `status=${abnormalAssign.status}, expected 400`);
      }
    }

    const report = await request('POST', '/api/reports', {
      order_id: orderId,
      author_id: 'r',
      author_name: 'R',
      report_content: 'Test'
    });
    test('Create report draft', report.status === 201, `status=${report.status}`);
    
    const reportId = report.data?.id;

    if (reportId) {
      await request('POST', `/api/reports/${reportId}/submit`, {
        submitter_id: 'r',
        submitter_name: 'R'
      });
      
      const review = await request('POST', `/api/reports/${reportId}/review`, {
        reviewer_id: 'rv',
        reviewer_name: 'RV',
        review_result: 'APPROVED',
        comment: 'OK'
      });
      test('Report review approved', 
        review.data?.report?.status === 'APPROVED',
        `status=${review.data?.report?.status}`);
    }

    const status = await request('GET', `/api/query/status/${order.data?.order_no}`);
    test('Status query works', status.status === 200, `status=${status.status}`);
    test('RULE: Approved report can be viewed externally',
      status.data?.can_view_report === true,
      `can_view_report=${status.data?.can_view_report}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

function cleanup() {
  server.kill();
  try { fs.unlinkSync(serverFile); } catch (e) {}
}
