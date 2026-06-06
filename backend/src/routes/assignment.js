const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { addStatusHistory, generateOrderNo } = require('../utils');

router.get('/', async (req, res) => {
  try {
    const { status, assignee_id, item_id } = req.query;
    let sql = 'SELECT ta.*, ti.item_name, ti.item_code, sv.vial_no, sv.sample_name, co.order_no, co.client_name FROM task_assignments ta LEFT JOIN test_items ti ON ta.item_id = ti.id LEFT JOIN sample_vials sv ON ti.vial_id = sv.id LEFT JOIN commission_orders co ON sv.order_id = co.id WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND ta.status = ?';
      params.push(status);
    }
    if (assignee_id) {
      sql += ' AND ta.assignee_id = ?';
      params.push(assignee_id);
    }
    if (item_id) {
      sql += ' AND ta.item_id = ?';
      params.push(item_id);
    }
    sql += ' ORDER BY ta.created_at DESC';
    
    const assignments = await db.all(sql, params);
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { item_id, assigner_id, assigner_name, assignee_id, assignee_name, deadline, priority, remark } = req.body;
    
    if (!item_id || !assigner_id || !assigner_name || !assignee_id || !assignee_name) {
      return res.status(400).json({ error: 'Item ID, assigner and assignee info are required' });
    }
    
    const item = await db.get('SELECT ti.*, sv.status as vial_status, sv.id as vial_id FROM test_items ti LEFT JOIN sample_vials sv ON ti.vial_id = sv.id WHERE ti.id = ?', [item_id]);
    
    if (!item) {
      return res.status(404).json({ error: 'Test item not found' });
    }
    
    if (item.vial_status === 'PENDING') {
      return res.status(400).json({ 
        error: 'RULE_VIOLATION: Cannot assign task. Sample vial has not been received yet.',
        rule_code: 'SAMPLE_NOT_RECEIVED',
        detail: '样品未收样不能分派检测，请先完成收样操作'
      });
    }
    
    if (item.vial_status === 'ABNORMAL') {
      return res.status(400).json({
        error: 'RULE_VIOLATION: Cannot assign task. Sample vial is in abnormal status.',
        rule_code: 'SAMPLE_ABNORMAL',
        detail: '异常样品不能分派检测，请先处理异常样品'
      });
    }
    
    if (item.status === 'ASSIGNED') {
      return res.status(400).json({ error: 'Test item already assigned' });
    }
    
    const now = new Date().toISOString();
    const assignmentId = uuidv4();
    const assignmentNo = generateOrderNo('FP');
    
    await db.run(
      `INSERT INTO task_assignments (id, item_id, assignment_no, assigner_id, assigner_name, assignee_id, assignee_name, assign_time, deadline, priority, status, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assignmentId, item_id, assignmentNo, assigner_id, assigner_name, assignee_id, assignee_name, now, deadline, priority || 'NORMAL', 'ASSIGNED', remark, now, now]
    );
    
    await db.run(
      'UPDATE test_items SET status = ?, tester_id = ?, tester_name = ?, assigned_at = ?, updated_at = ? WHERE id = ?',
      ['ASSIGNED', assignee_id, assignee_name, now, now, item_id]
    );
    
    await addStatusHistory('test_item', item_id, item.status, 'ASSIGNED', assigner_id, assigner_name, now);
    
    const vialItems = await db.all('SELECT status FROM test_items WHERE vial_id = ?', [item.vial_id]);
    const allAssigned = vialItems.every(i => i.status === 'ASSIGNED' || i.status === 'COMPLETED');
    
    if (allAssigned) {
      const vial = await db.get('SELECT status FROM sample_vials WHERE id = ?', [item.vial_id]);
      if (vial.status === 'ITEMS_CONFIRMED' || vial.status === 'RECEIVED') {
        await db.run('UPDATE sample_vials SET status = ?, updated_at = ? WHERE id = ?', ['ASSIGNED', now, item.vial_id]);
        await addStatusHistory('sample_vial', item.vial_id, vial.status, 'ASSIGNED', assigner_id, assigner_name, now);
      }
    }
    
    const assignment = await db.get('SELECT ta.*, ti.item_name, ti.item_code, sv.vial_no, sv.sample_name, co.order_no FROM task_assignments ta LEFT JOIN test_items ti ON ta.item_id = ti.id LEFT JOIN sample_vials sv ON ti.vial_id = sv.id LEFT JOIN commission_orders co ON sv.order_id = co.id WHERE ta.id = ?', [assignmentId]);
    
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { item_ids, assigner_id, assigner_name, assignee_id, assignee_name, deadline, priority } = req.body;
    
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'Item IDs are required' });
    }
    
    const results = [];
    const errors = [];
    
    for (const item_id of item_ids) {
      try {
        const item = await db.get('SELECT ti.*, sv.status as vial_status FROM test_items ti LEFT JOIN sample_vials sv ON ti.vial_id = sv.id WHERE ti.id = ?', [item_id]);
        
        if (!item) {
          errors.push({ item_id, error: 'Test item not found' });
          continue;
        }
        
        if (item.vial_status === 'PENDING') {
          errors.push({ 
            item_id, 
            error: 'RULE_VIOLATION: Sample not received',
            rule_code: 'SAMPLE_NOT_RECEIVED'
          });
          continue;
        }
        
        if (item.status === 'ASSIGNED') {
          errors.push({ item_id, error: 'Already assigned' });
          continue;
        }
        
        const now = new Date().toISOString();
        const assignmentId = uuidv4();
        const assignmentNo = generateOrderNo('FP');
        
        await db.run(
          `INSERT INTO task_assignments (id, item_id, assignment_no, assigner_id, assigner_name, assignee_id, assignee_name, assign_time, deadline, priority, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [assignmentId, item_id, assignmentNo, assigner_id, assigner_name, assignee_id, assignee_name, now, deadline, priority || 'NORMAL', 'ASSIGNED', now, now]
        );
        
        await db.run(
          'UPDATE test_items SET status = ?, tester_id = ?, tester_name = ?, assigned_at = ?, updated_at = ? WHERE id = ?',
          ['ASSIGNED', assignee_id, assignee_name, now, now, item_id]
        );
        
        await addStatusHistory('test_item', item_id, item.status, 'ASSIGNED', assigner_id, assigner_name, now);
        
        results.push({ item_id, assignment_id: assignmentId, success: true });
      } catch (err) {
        errors.push({ item_id, error: err.message });
      }
    }
    
    res.json({ success: results.length, failed: errors.length, results, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
