const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/status/:orderNo', async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM commission_orders WHERE order_no = ?', [req.params.orderNo]);
    if (!order) {
      return res.status(404).json({ error: 'Commission order not found' });
    }
    
    let canQuery = true;
    let report = null;
    
    if (order.status === 'COMPLETED') {
      report = await db.get(
        'SELECT * FROM report_drafts WHERE order_id = ? AND status = ? ORDER BY version DESC LIMIT 1',
        [order.id, 'APPROVED']
      );
      canQuery = report !== null;
    }
    
    if (!canQuery && order.status !== 'COMPLETED') {
      report = await db.get(
        'SELECT report_no, status, version, created_at FROM report_drafts WHERE order_id = ? ORDER BY version DESC LIMIT 1',
        [order.id]
      );
    }
    
    const vials = await db.all(
      'SELECT id, vial_no, vial_barcode, sample_name, status FROM sample_vials WHERE order_id = ?',
      [order.id]
    );
    
    const vialIds = vials.map(v => v.id);
    let testItems = [];
    if (vialIds.length > 0) {
      const placeholders = vialIds.map(() => '?').join(',');
      testItems = await db.all(
        `SELECT id, vial_id, item_code, item_name, status, tester_name FROM test_items WHERE vial_id IN (${placeholders})`,
        vialIds
      );
    }
    
    const statusHistory = await db.all(
      'SELECT old_status, new_status, operator_name, operation_time, remark FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at',
      ['commission_order', order.id]
    );
    
    res.json({
      order: {
        id: order.id,
        order_no: order.order_no,
        client_name: order.client_name,
        status: order.status,
        commission_date: order.commission_date
      },
      can_view_report: canQuery,
      report: canQuery ? report : (report ? { report_no: report.report_no, status: report.status, version: report.version } : null),
      vials,
      test_items: testItems,
      status_history: statusHistory
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard/stats', async (req, res) => {
  try {
    const orderStats = await db.all(
      'SELECT status, COUNT(*) as count FROM commission_orders GROUP BY status'
    );
    
    const sampleStats = await db.all(
      'SELECT status, COUNT(*) as count FROM sample_vials GROUP BY status'
    );
    
    const itemStats = await db.all(
      'SELECT status, COUNT(*) as count FROM test_items GROUP BY status'
    );
    
    const reportStats = await db.all(
      'SELECT status, COUNT(*) as count FROM report_drafts GROUP BY status'
    );
    
    res.json({
      orders: orderStats,
      samples: sampleStats,
      test_items: itemStats,
      reports: reportStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:entityType/:entityId', async (req, res) => {
  try {
    const history = await db.all(
      'SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      [req.params.entityType, req.params.entityId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
