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

router.get('/abnormal-dashboard', async (req, res) => {
  try {
    const { start_date, end_date, client_name, abnormal_type } = req.query;
    
    let whereClauses = ['sv.status = ?'];
    let params = ['ABNORMAL'];
    
    if (start_date) {
      whereClauses.push('co.commission_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      whereClauses.push('co.commission_date <= ?');
      params.push(end_date);
    }
    if (client_name) {
      whereClauses.push('co.client_name LIKE ?');
      params.push(`%${client_name}%`);
    }
    
    const whereSql = whereClauses.join(' AND ');
    
    const abnormalSamples = await db.all(
      `SELECT 
        sv.id,
        sv.vial_no,
        sv.vial_barcode,
        sv.sample_name,
        sv.sample_type,
        sv.abnormal_reason,
        sv.status,
        sv.created_at as sample_created_at,
        co.id as order_id,
        co.order_no,
        co.client_name,
        co.client_contact,
        co.client_phone,
        co.commission_date,
        co.status as order_status,
        sr.id as receipt_id,
        sr.receipt_no,
        sr.receiver_name,
        sr.receipt_time,
        sr.condition_check_passed,
        sr.condition_remark,
        sr.abnormal_reason as receipt_abnormal_reason
      FROM sample_vials sv
      LEFT JOIN commission_orders co ON sv.order_id = co.id
      LEFT JOIN sample_receipts sr ON sv.id = sr.vial_id
      WHERE ${whereSql}
      ORDER BY sv.created_at DESC`,
      params
    );
    
    const abnormalTestItems = await db.all(
      `SELECT 
        ti.id,
        ti.item_code,
        ti.item_name,
        ti.test_standard,
        ti.status as item_status,
        ti.result_value,
        ti.remark as item_remark,
        sv.id as vial_id,
        sv.vial_no,
        sv.sample_name,
        co.id as order_id,
        co.order_no,
        co.client_name
      FROM test_items ti
      LEFT JOIN sample_vials sv ON ti.vial_id = sv.id
      LEFT JOIN commission_orders co ON sv.order_id = co.id
      WHERE ti.status = 'ABNORMAL'
      ORDER BY ti.created_at DESC`
    );
    
    const stats = await db.get(
      `SELECT 
        COUNT(DISTINCT CASE WHEN sv.status = 'ABNORMAL' THEN sv.id END) as abnormal_sample_count,
        COUNT(DISTINCT CASE WHEN ti.status = 'ABNORMAL' THEN ti.id END) as abnormal_item_count,
        COUNT(DISTINCT CASE WHEN sr.is_abnormal = 1 THEN sr.id END) as abnormal_receipt_count,
        COUNT(DISTINCT co.id) as affected_order_count
      FROM sample_vials sv
      LEFT JOIN commission_orders co ON sv.order_id = co.id
      LEFT JOIN sample_receipts sr ON sv.id = sr.vial_id
      LEFT JOIN test_items ti ON sv.id = ti.vial_id
      WHERE sv.status = 'ABNORMAL' OR ti.status = 'ABNORMAL' OR sr.is_abnormal = 1`
    );
    
    res.json({
      stats: {
        abnormal_sample_count: stats?.abnormal_sample_count || 0,
        abnormal_item_count: stats?.abnormal_item_count || 0,
        abnormal_receipt_count: stats?.abnormal_receipt_count || 0,
        affected_order_count: stats?.affected_order_count || 0
      },
      abnormal_samples: abnormalSamples,
      abnormal_test_items: abnormalTestItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
