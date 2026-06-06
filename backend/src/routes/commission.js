const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { addStatusHistory, generateOrderNo } = require('../utils');

router.get('/', async (req, res) => {
  try {
    const { status, client_name } = req.query;
    let sql = 'SELECT * FROM commission_orders WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (client_name) {
      sql += ' AND client_name LIKE ?';
      params.push(`%${client_name}%`);
    }
    sql += ' ORDER BY created_at DESC';
    
    const orders = await db.all(sql, params);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM commission_orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Commission order not found' });
    }
    
    const vials = await db.all('SELECT * FROM sample_vials WHERE order_id = ?', [req.params.id]);
    
    const vialIds = vials.map(v => v.id);
    let testItems = [];
    if (vialIds.length > 0) {
      const placeholders = vialIds.map(() => '?').join(',');
      testItems = await db.all(`SELECT * FROM test_items WHERE vial_id IN (${placeholders})`, vialIds);
    }
    
    const reports = await db.all('SELECT * FROM report_drafts WHERE order_id = ? ORDER BY version DESC', [req.params.id]);
    
    const statusHistory = await db.all(
      'SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      ['commission_order', req.params.id]
    );
    
    res.json({ ...order, vials, testItems, reports, statusHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { client_name, client_contact, client_phone, remark, samples } = req.body;
    
    if (!client_name || !samples || samples.length === 0) {
      return res.status(400).json({ error: 'Client name and samples are required' });
    }
    
    const orderId = uuidv4();
    const orderNo = generateOrderNo('WT');
    const now = new Date().toISOString();
    
    await db.run(
      `INSERT INTO commission_orders (id, order_no, client_name, client_contact, client_phone, commission_date, status, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, orderNo, client_name, client_contact, client_phone, now, 'SUBMITTED', remark, now, now]
    );
    
    for (const sample of samples) {
      const vialId = uuidv4();
      const vialNo = generateOrderNo('YP');
      await db.run(
        `INSERT INTO sample_vials (id, order_id, vial_no, vial_barcode, sample_name, sample_type, storage_condition, sample_quantity, sample_unit, collection_date, collection_location, status, remark, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vialId, orderId, vialNo, sample.vial_barcode || vialNo, sample.sample_name, sample.sample_type, 
         sample.storage_condition, sample.sample_quantity, sample.sample_unit, 
         sample.collection_date, sample.collection_location, 'PENDING', sample.remark, now, now]
      );
      
      if (sample.test_items && sample.test_items.length > 0) {
        for (const item of sample.test_items) {
          const itemId = uuidv4();
          await db.run(
            `INSERT INTO test_items (id, vial_id, item_code, item_name, test_standard, required_condition, status, remark, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemId, vialId, item.item_code, item.item_name, item.test_standard, 
             item.required_condition, 'PENDING', item.remark, now, now]
          );
        }
      }
    }
    
    await addStatusHistory('commission_order', orderId, null, 'SUBMITTED', null, '委托人提交', now);
    
    const createdOrder = await db.get('SELECT * FROM commission_orders WHERE id = ?', [orderId]);
    res.status(201).json(createdOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, operator_id, operator_name, remark } = req.body;
    const now = new Date().toISOString();
    
    const order = await db.get('SELECT * FROM commission_orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Commission order not found' });
    }
    
    await db.run(
      'UPDATE commission_orders SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, req.params.id]
    );
    
    await addStatusHistory('commission_order', req.params.id, order.status, status, operator_id, operator_name || remark, now);
    
    const updated = await db.get('SELECT * FROM commission_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
