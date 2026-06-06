const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { addStatusHistory, generateOrderNo } = require('../utils');

router.get('/', async (req, res) => {
  try {
    const { status, order_id, barcode } = req.query;
    let sql = 'SELECT * FROM sample_vials WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (order_id) {
      sql += ' AND order_id = ?';
      params.push(order_id);
    }
    if (barcode) {
      sql += ' AND vial_barcode LIKE ?';
      params.push(`%${barcode}%`);
    }
    sql += ' ORDER BY created_at DESC';
    
    const vials = await db.all(sql, params);
    res.json(vials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/barcode/:barcode', async (req, res) => {
  try {
    const vial = await db.get('SELECT * FROM sample_vials WHERE vial_barcode = ?', [req.params.barcode]);
    if (!vial) {
      return res.status(404).json({ error: 'Sample vial not found' });
    }
    
    const order = await db.get('SELECT * FROM commission_orders WHERE id = ?', [vial.order_id]);
    const testItems = await db.all('SELECT * FROM test_items WHERE vial_id = ?', [vial.id]);
    const receipts = await db.all('SELECT * FROM sample_receipts WHERE vial_id = ? ORDER BY created_at DESC', [vial.id]);
    const statusHistory = await db.all(
      'SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      ['sample_vial', vial.id]
    );
    
    res.json({ ...vial, order, testItems, receipts, statusHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/receive', async (req, res) => {
  try {
    const { vial_barcode, receiver_id, receiver_name, condition_check_passed, condition_remark, is_abnormal, abnormal_reason, remark } = req.body;
    
    if (!vial_barcode || !receiver_id || !receiver_name) {
      return res.status(400).json({ error: 'Barcode, receiver info are required' });
    }
    
    const vial = await db.get('SELECT * FROM sample_vials WHERE vial_barcode = ?', [vial_barcode]);
    if (!vial) {
      return res.status(404).json({ error: 'Sample vial not found' });
    }
    
    if (vial.status !== 'PENDING') {
      return res.status(400).json({ error: `Sample vial already processed, current status: ${vial.status}` });
    }
    
    const now = new Date().toISOString();
    const receiptId = uuidv4();
    const receiptNo = generateOrderNo('SY');
    
    let vialStatus = 'RECEIVED';
    if (is_abnormal || !condition_check_passed) {
      vialStatus = 'ABNORMAL';
    }
    
    await db.run(
      `INSERT INTO sample_receipts (id, vial_id, receipt_no, receiver_id, receiver_name, receipt_time, condition_check_passed, condition_remark, is_abnormal, abnormal_reason, remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [receiptId, vial.id, receiptNo, receiver_id, receiver_name, now, condition_check_passed ? 1 : 0, condition_remark, is_abnormal ? 1 : 0, abnormal_reason, remark, now]
    );
    
    await db.run(
      'UPDATE sample_vials SET status = ?, abnormal_reason = ?, updated_at = ? WHERE id = ?',
      [vialStatus, abnormal_reason, now, vial.id]
    );
    
    await addStatusHistory('sample_vial', vial.id, 'PENDING', vialStatus, receiver_id, receiver_name, now);
    
    const order = await db.get('SELECT * FROM commission_orders WHERE id = ?', [vial.order_id]);
    const pendingVials = await db.get(
      'SELECT COUNT(*) as count FROM sample_vials WHERE order_id = ? AND status = ?',
      [vial.order_id, 'PENDING']
    );
    
    if (pendingVials.count === 0 && order.status === 'SUBMITTED') {
      const allVials = await db.all('SELECT status FROM sample_vials WHERE order_id = ?', [vial.order_id]);
      const hasAbnormal = allVials.some(v => v.status === 'ABNORMAL');
      const newOrderStatus = hasAbnormal ? 'ABNORMAL' : 'SAMPLED';
      
      await db.run(
        'UPDATE commission_orders SET status = ?, updated_at = ? WHERE id = ?',
        [newOrderStatus, now, vial.order_id]
      );
      await addStatusHistory('commission_order', vial.order_id, order.status, newOrderStatus, receiver_id, receiver_name, now);
    }
    
    const updatedVial = await db.get('SELECT * FROM sample_vials WHERE id = ?', [vial.id]);
    const receipt = await db.get('SELECT * FROM sample_receipts WHERE id = ?', [receiptId]);
    
    res.json({ vial: updatedVial, receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/items/confirm', async (req, res) => {
  try {
    const { item_ids, operator_id, operator_name } = req.body;
    const vial = await db.get('SELECT * FROM sample_vials WHERE id = ?', [req.params.id]);
    
    if (!vial) {
      return res.status(404).json({ error: 'Sample vial not found' });
    }
    
    if (vial.status === 'PENDING') {
      return res.status(400).json({ error: 'Sample vial not received yet' });
    }
    
    if (vial.status === 'ABNORMAL') {
      return res.status(400).json({ error: 'Cannot confirm items for abnormal sample' });
    }
    
    const now = new Date().toISOString();
    
    if (item_ids && item_ids.length > 0) {
      const placeholders = item_ids.map(() => '?').join(',');
      await db.run(
        `UPDATE test_items SET status = ?, updated_at = ? WHERE id IN (${placeholders}) AND vial_id = ?`,
        ['CONFIRMED', now, ...item_ids, req.params.id]
      );
    } else {
      await db.run(
        'UPDATE test_items SET status = ?, updated_at = ? WHERE vial_id = ?',
        ['CONFIRMED', now, req.params.id]
      );
    }
    
    if (vial.status === 'RECEIVED') {
      await db.run(
        'UPDATE sample_vials SET status = ?, updated_at = ? WHERE id = ?',
        ['ITEMS_CONFIRMED', now, req.params.id]
      );
      await addStatusHistory('sample_vial', vial.id, vial.status, 'ITEMS_CONFIRMED', operator_id, operator_name, now);
    }
    
    const updatedVial = await db.get('SELECT * FROM sample_vials WHERE id = ?', [req.params.id]);
    const testItems = await db.all('SELECT * FROM test_items WHERE vial_id = ?', [req.params.id]);
    
    res.json({ vial: updatedVial, testItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
