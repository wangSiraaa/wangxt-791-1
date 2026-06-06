const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const generateOrderNo = (prefix) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${year}${month}${day}${random}`;
};

const addStatusHistory = async (entityType, entityId, oldStatus, newStatus, operatorId, operatorName, operationTime = null) => {
  const now = operationTime || new Date().toISOString();
  const historyId = uuidv4();
  
  await db.run(
    `INSERT INTO status_history (id, entity_type, entity_id, old_status, new_status, operator_id, operator_name, operation_time, remark, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [historyId, entityType, entityId, oldStatus, newStatus, operatorId, operatorName, now, null, now]
  );
  
  return historyId;
};

const checkSampleReceived = async (vialId) => {
  const vial = await db.get('SELECT status FROM sample_vials WHERE id = ?', [vialId]);
  if (!vial) return false;
  return vial.status !== 'PENDING';
};

const canAssignTask = async (itemId) => {
  const item = await db.get(
    'SELECT ti.*, sv.status as vial_status FROM test_items ti LEFT JOIN sample_vials sv ON ti.vial_id = sv.id WHERE ti.id = ?',
    [itemId]
  );
  
  if (!item) {
    return { can: false, reason: 'Test item not found' };
  }
  
  if (item.vial_status === 'PENDING') {
    return { can: false, reason: 'Sample not received', rule_code: 'SAMPLE_NOT_RECEIVED' };
  }
  
  if (item.vial_status === 'ABNORMAL') {
    return { can: false, reason: 'Sample is abnormal', rule_code: 'SAMPLE_ABNORMAL' };
  }
  
  if (item.status === 'ASSIGNED') {
    return { can: false, reason: 'Already assigned' };
  }
  
  return { can: true };
};

const canViewReport = async (reportId) => {
  const report = await db.get('SELECT status FROM report_drafts WHERE id = ?', [reportId]);
  if (!report) return false;
  return report.status === 'APPROVED';
};

module.exports = {
  generateOrderNo,
  addStatusHistory,
  checkSampleReceived,
  canAssignTask,
  canViewReport
};
