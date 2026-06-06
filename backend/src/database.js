const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/lims.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS commission_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      client_contact TEXT,
      client_phone TEXT,
      commission_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sample_vials (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      vial_no TEXT UNIQUE NOT NULL,
      vial_barcode TEXT UNIQUE NOT NULL,
      sample_name TEXT NOT NULL,
      sample_type TEXT,
      storage_condition TEXT NOT NULL,
      sample_quantity REAL,
      sample_unit TEXT,
      collection_date TEXT,
      collection_location TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      abnormal_reason TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES commission_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS test_items (
      id TEXT PRIMARY KEY,
      vial_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      test_standard TEXT,
      required_condition TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      tester_id TEXT,
      tester_name TEXT,
      assigned_at TEXT,
      completed_at TEXT,
      result_value TEXT,
      result_unit TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (vial_id) REFERENCES sample_vials(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sample_receipts (
      id TEXT PRIMARY KEY,
      vial_id TEXT NOT NULL,
      receipt_no TEXT UNIQUE NOT NULL,
      receiver_id TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receipt_time TEXT NOT NULL,
      condition_check_passed INTEGER NOT NULL DEFAULT 1,
      condition_remark TEXT,
      is_abnormal INTEGER NOT NULL DEFAULT 0,
      abnormal_reason TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (vial_id) REFERENCES sample_vials(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS task_assignments (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      assignment_no TEXT UNIQUE NOT NULL,
      assigner_id TEXT NOT NULL,
      assigner_name TEXT NOT NULL,
      assignee_id TEXT NOT NULL,
      assignee_name TEXT NOT NULL,
      assign_time TEXT NOT NULL,
      deadline TEXT,
      priority TEXT DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'ASSIGNED',
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES test_items(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS report_drafts (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      report_no TEXT UNIQUE NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_report_id TEXT,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      report_content TEXT,
      conclusion TEXT,
      remark TEXT,
      FOREIGN KEY (order_id) REFERENCES commission_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS review_comments (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      review_time TEXT NOT NULL,
      review_result TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES report_drafts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      operation_time TEXT NOT NULL,
      remark TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_vials_order ON sample_vials(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_items_vial ON test_items(vial_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_receipts_vial ON sample_receipts(vial_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_assignments_item ON task_assignments(item_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_reports_order ON report_drafts(order_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_history_entity ON status_history(entity_type, entity_id)`);
  });
  
  console.log('Database initialized');
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  initDatabase,
  run,
  get,
  all,
  db
};
