const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { addStatusHistory, generateOrderNo } = require('../utils');

router.get('/', async (req, res) => {
  try {
    const { status, order_id } = req.query;
    let sql = 'SELECT rd.*, co.order_no, co.client_name FROM report_drafts rd LEFT JOIN commission_orders co ON rd.order_id = co.id WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND rd.status = ?';
      params.push(status);
    }
    if (order_id) {
      sql += ' AND rd.order_id = ?';
      params.push(order_id);
    }
    sql += ' ORDER BY rd.created_at DESC';
    
    const reports = await db.all(sql, params);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const report = await db.get('SELECT rd.*, co.order_no, co.client_name FROM report_drafts rd LEFT JOIN commission_orders co ON rd.order_id = co.id WHERE rd.id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const reviews = await db.all('SELECT * FROM review_comments WHERE report_id = ? ORDER BY created_at DESC', [req.params.id]);
    const history = await db.all('SELECT * FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC', ['report', req.params.id]);
    
    res.json({ ...report, reviews, statusHistory: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { order_id, author_id, author_name, report_content, conclusion, remark } = req.body;
    
    if (!order_id || !author_id || !author_name) {
      return res.status(400).json({ error: 'Order ID and author info are required' });
    }
    
    const order = await db.get('SELECT * FROM commission_orders WHERE id = ?', [order_id]);
    if (!order) {
      return res.status(404).json({ error: 'Commission order not found' });
    }
    
    const now = new Date().toISOString();
    const reportId = uuidv4();
    const reportNo = generateOrderNo('BG');
    
    const lastReport = await db.get(
      'SELECT MAX(version) as max_version FROM report_drafts WHERE order_id = ?',
      [order_id]
    );
    const version = (lastReport?.max_version || 0) + 1;
    
    await db.run(
      `INSERT INTO report_drafts (id, order_id, report_no, version, author_id, author_name, created_at, updated_at, status, report_content, conclusion, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, order_id, reportNo, version, author_id, author_name, now, now, 'DRAFT', report_content, conclusion, remark]
    );
    
    await addStatusHistory('report', reportId, null, 'DRAFT', author_id, author_name, now);
    
    const created = await db.get('SELECT rd.*, co.order_no, co.client_name FROM report_drafts rd LEFT JOIN commission_orders co ON rd.order_id = co.id WHERE rd.id = ?', [reportId]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const { submitter_id, submitter_name } = req.body;
    const now = new Date().toISOString();
    
    const report = await db.get('SELECT * FROM report_drafts WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.status !== 'DRAFT' && report.status !== 'REJECTED') {
      return res.status(400).json({ error: `Cannot submit report with status: ${report.status}` });
    }
    
    await db.run(
      'UPDATE report_drafts SET status = ?, updated_at = ? WHERE id = ?',
      ['PENDING_REVIEW', now, req.params.id]
    );
    
    await addStatusHistory('report', req.params.id, report.status, 'PENDING_REVIEW', submitter_id, submitter_name, now);
    
    const updated = await db.get('SELECT rd.*, co.order_no, co.client_name FROM report_drafts rd LEFT JOIN commission_orders co ON rd.order_id = co.id WHERE rd.id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { reviewer_id, reviewer_name, review_result, comment } = req.body;
    
    if (!reviewer_id || !reviewer_name || !review_result) {
      return res.status(400).json({ error: 'Reviewer info and result are required' });
    }
    
    const report = await db.get('SELECT * FROM report_drafts WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.status !== 'PENDING_REVIEW') {
      return res.status(400).json({ error: `Cannot review report with status: ${report.status}` });
    }
    
    const now = new Date().toISOString();
    const reviewId = uuidv4();
    
    await db.run(
      `INSERT INTO review_comments (id, report_id, reviewer_id, reviewer_name, review_time, review_result, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reviewId, req.params.id, reviewer_id, reviewer_name, now, review_result, comment, now]
    );
    
    let newStatus = report.status;
    if (review_result === 'APPROVED') {
      newStatus = 'APPROVED';
    } else if (review_result === 'REJECTED') {
      newStatus = 'REJECTED';
    }
    
    await db.run(
      'UPDATE report_drafts SET status = ?, updated_at = ? WHERE id = ?',
      [newStatus, now, req.params.id]
    );
    
    await addStatusHistory('report', req.params.id, report.status, newStatus, reviewer_id, reviewer_name, now);
    
    if (newStatus === 'APPROVED') {
      const order = await db.get('SELECT * FROM commission_orders WHERE id = ?', [report.order_id]);
      if (order.status !== 'COMPLETED') {
        await db.run(
          'UPDATE commission_orders SET status = ?, updated_at = ? WHERE id = ?',
          ['COMPLETED', now, report.order_id]
        );
        await addStatusHistory('commission_order', report.order_id, order.status, 'COMPLETED', reviewer_id, reviewer_name, now);
      }
    }
    
    const updated = await db.get('SELECT rd.*, co.order_no, co.client_name FROM report_drafts rd LEFT JOIN commission_orders co ON rd.order_id = co.id WHERE rd.id = ?', [req.params.id]);
    const review = await db.get('SELECT * FROM review_comments WHERE id = ?', [reviewId]);
    
    res.json({ report: updated, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resubmit', async (req, res) => {
  try {
    const { author_id, author_name, report_content, conclusion, remark } = req.body;
    
    const report = await db.get('SELECT * FROM report_drafts WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    if (report.status !== 'REJECTED') {
      return res.status(400).json({ error: `Cannot resubmit report with status: ${report.status}` });
    }
    
    const now = new Date().toISOString();
    const newReportId = uuidv4();
    const reportNo = generateOrderNo('BG');
    
    const lastReport = await db.get(
      'SELECT MAX(version) as max_version FROM report_drafts WHERE order_id = ?',
      [report.order_id]
    );
    const newVersion = (lastReport?.max_version || report.version) + 1;
    
    await db.run(
      `INSERT INTO report_drafts (id, order_id, report_no, version, parent_report_id, author_id, author_name, created_at, updated_at, status, report_content, conclusion, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newReportId, report.order_id, reportNo, newVersion, req.params.id, author_id || report.author_id, author_name || report.author_name, now, now, 'DRAFT', report_content || report.report_content, conclusion || report.conclusion, remark || report.remark]
    );
    
    await addStatusHistory('report', newReportId, null, 'DRAFT', author_id || report.author_id, author_name || report.author_name, now);
    
    const newReport = await db.get('SELECT rd.*, co.order_no, co.client_name FROM report_drafts rd LEFT JOIN commission_orders co ON rd.order_id = co.id WHERE rd.id = ?', [newReportId]);
    res.status(201).json({ report: newReport, parent_report_id: req.params.id, message: 'Old version preserved, new version created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
