const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  try {
    const { vial_id, status } = req.query;
    let sql = 'SELECT ti.*, sv.vial_no, sv.sample_name, co.order_no, co.client_name FROM test_items ti LEFT JOIN sample_vials sv ON ti.vial_id = sv.id LEFT JOIN commission_orders co ON sv.order_id = co.id WHERE 1=1';
    const params = [];
    
    if (vial_id) {
      sql += ' AND ti.vial_id = ?';
      params.push(vial_id);
    }
    if (status) {
      sql += ' AND ti.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY ti.created_at DESC';
    
    const items = await db.all(sql, params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await db.get('SELECT ti.*, sv.vial_no, sv.sample_name, co.order_no, co.client_name FROM test_items ti LEFT JOIN sample_vials sv ON ti.vial_id = sv.id LEFT JOIN commission_orders co ON sv.order_id = co.id WHERE ti.id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ error: 'Test item not found' });
    }
    
    const assignments = await db.all('SELECT * FROM task_assignments WHERE item_id = ? ORDER BY created_at DESC', [req.params.id]);
    const statusHistory = await db.all('SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC', ['test_item', req.params.id]);
    
    res.json({ ...item, assignments, statusHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
