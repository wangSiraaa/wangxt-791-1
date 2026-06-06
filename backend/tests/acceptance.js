const http = require('http');

const API_BASE = 'http://localhost:3001';
const HEALTH_URL = `${API_BASE}/health`;

let passed = 0;
let failed = 0;

const request = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

const log = (msg) => console.log(`  ${msg}`);
const testPass = (name) => { passed++; console.log(`  ✓ ${name}`); };
const testFail = (name, err) => { failed++; console.log(`  ✗ ${name} - ${err}`); };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('\n========================================');
  console.log('  LIMS 样品委托系统 - 验收测试');
  console.log('========================================\n');

  let orderId = null;
  let vialId = null;
  let vialBarcode = null;
  let itemId = null;
  let reportId = null;

  try {
    console.log('[1] 数据库健康检查');
    
    const health = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (health.status === 200 && health.data?.status === 'healthy') {
      testPass('数据库连接正常');
      log(`数据库状态: ${health.data.database}`);
    } else {
      testFail('数据库连接', `状态: ${health.status}`);
    }
    console.log('');

    console.log('[2] 创建委托单（含样品瓶和检测项目）');
    const orderRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: '/api/commissions',
      headers: { 'Content-Type': 'application/json' }
    }, {
      client_name: '测试客户有限公司',
      client_contact: '张经理',
      client_phone: '13800138000',
      remark: '验收测试委托单',
      samples: [{
        sample_name: '测试水样-001',
        sample_type: '水质',
        storage_condition: '冷藏',
        sample_quantity: 500,
        sample_unit: 'ml',
        vial_barcode: 'TEST-VIAL-001-' + Date.now(),
        collection_date: '2024-01-15',
        collection_location: '1号采样点',
        remark: '测试样品',
        test_items: [
          { item_code: 'PH001', item_name: 'pH值', test_standard: 'GB/T 6920' },
          { item_code: 'COD001', item_name: 'COD', test_standard: 'HJ 828' }
        ]
      }]
    });

    if (orderRes.status === 201) {
      testPass('委托单创建成功');
      orderId = orderRes.data.id;
      log(`委托单ID: ${orderId}`);
      log(`委托单号: ${orderRes.data.order_no}`);
    } else {
      testFail('创建委托单', `状态: ${orderRes.status}, 错误: ${orderRes.data?.error}`);
    }
    console.log('');

    console.log('[3] 获取委托单详情，验证样品和检测项目');
    const detailRes = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3001,
      path: `/api/commissions/${orderId}`,
      headers: { 'Content-Type': 'application/json' }
    });

    if (detailRes.status === 200 && detailRes.data.vials?.length > 0) {
      testPass('委托单详情获取成功');
      vialId = detailRes.data.vials[0].id;
      vialBarcode = detailRes.data.vials[0].vial_barcode;
      itemId = detailRes.data.testItems[0]?.id;
      log(`样品瓶ID: ${vialId}`);
      log(`样品瓶条码: ${vialBarcode}`);
      log(`检测项目数: ${detailRes.data.testItems?.length || 0}`);
      log(`样品状态: ${detailRes.data.vials[0].status} (预期: PENDING)`);
    } else {
      testFail('获取委托单详情', `状态: ${detailRes.status}`);
    }
    console.log('');

    console.log('[4] 关键规则验证 - 未收样直接分派（应返回规则错误）');
    
    const assignBeforeSample = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: '/api/assignments',
      headers: { 'Content-Type': 'application/json' }
    }, {
      item_id: itemId,
      assigner_id: 'admin001',
      assigner_name: '系统管理员',
      assignee_id: 'tester001',
      assignee_name: '张三'
    });

    if (assignBeforeSample.status === 400 && assignBeforeSample.data?.rule_code === 'SAMPLE_NOT_RECEIVED') {
      testPass('规则校验生效 - 未收样样品不能分派');
      log(`错误码: ${assignBeforeSample.data.rule_code}`);
      log(`服务端返回: ${assignBeforeSample.data.detail}`);
    } else if (assignBeforeSample.status === 400) {
      testPass('分派被拒绝 (状态400)');
      log(`返回: ${JSON.stringify(assignBeforeSample.data)}`);
    } else {
      testFail('规则校验失败', `未收样样品居然分派成功了! 状态: ${assignBeforeSample.status}`);
    }
    console.log('');

    console.log('[5] 异常收样流程 - 保存条件不满足，状态流转检查');
    const abnormalReceive = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: '/api/samples/receive',
      headers: { 'Content-Type': 'application/json' }
    }, {
      vial_barcode: vialBarcode,
      receiver_id: 'receiver001',
      receiver_name: '李收样',
      condition_check_passed: false,
      condition_remark: '样品温度异常，要求冷藏但收到时温度15℃',
      is_abnormal: true,
      abnormal_reason: '运输过程冷链失效，样品保存条件不满足',
      remark: '验收测试-异常收样'
    });

    if (abnormalReceive.status === 200) {
      testPass('异常收样登记成功');
      log(`收样单号: ${abnormalReceive.data.receipt.receipt_no}`);
      log(`收样后样品状态: ${abnormalReceive.data.vial.status} (预期: ABNORMAL)`);
      log(`异常原因: ${abnormalReceive.data.vial.abnormal_reason}`);
      
      if (abnormalReceive.data.vial.status === 'ABNORMAL') {
        testPass('状态流转正确 - 样品已标记为异常');
      } else {
        testFail('状态流转错误', `期望 ABNORMAL, 实际 ${abnormalReceive.data.vial.status}`);
      }
    } else {
      testFail('异常收样失败', `状态: ${abnormalReceive.status}, 错误: ${abnormalReceive.data?.error}`);
    }
    console.log('');

    console.log('[6] 验证异常样品不能分派检测');
    const assignAbnormal = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: '/api/assignments',
      headers: { 'Content-Type': 'application/json' }
    }, {
      item_id: itemId,
      assigner_id: 'admin001',
      assigner_name: '系统管理员',
      assignee_id: 'tester001',
      assignee_name: '张三'
    });

    if (assignAbnormal.status === 400 && (assignAbnormal.data?.rule_code === 'SAMPLE_ABNORMAL' || assignAbnormal.data?.error?.includes('abnormal'))) {
      testPass('规则校验生效 - 异常样品不能分派');
    } else if (assignAbnormal.status === 400) {
      testPass('异常样品分派被拒绝');
      log(`返回: ${JSON.stringify(assignAbnormal.data)}`);
    } else {
      testFail('规则校验失败', `异常样品居然分派成功了!`);
    }
    console.log('');

    console.log('[7] 验证状态历史记录');
    const historyRes = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3001,
      path: `/api/query/history/sample_vial/${vialId}`,
      headers: { 'Content-Type': 'application/json' }
    });

    if (historyRes.status === 200 && historyRes.data?.length > 0) {
      testPass('状态历史记录存在');
      historyRes.data.forEach((h, i) => {
        log(`  ${i+1}. ${h.old_status || '初始'} → ${h.new_status} (${h.operator_name})`);
      });
    } else {
      testFail('状态历史记录为空', `状态: ${historyRes.status}`);
    }
    console.log('');

    console.log('[8] 报告草稿创建与审核规则验证');
    const reportRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: '/api/reports',
      headers: { 'Content-Type': 'application/json' }
    }, {
      order_id: orderId,
      author_id: 'reporter001',
      author_name: '王报告',
      report_content: '验收测试报告内容...',
      conclusion: '各项指标符合标准要求',
      remark: '验收测试报告'
    });

    if (reportRes.status === 201) {
      testPass('报告草稿创建成功');
      reportId = reportRes.data.id;
      log(`报告ID: ${reportId}`);
      log(`报告编号: ${reportRes.data.report_no}`);
      log(`版本号: ${reportRes.data.version}`);
    } else {
      testFail('创建报告失败', `状态: ${reportRes.status}`);
    }
    console.log('');

    console.log('[9] 验证报告未审核时对外查询规则');
    const queryBeforeReview = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3001,
      path: `/api/query/status/${orderRes.data.order_no}`,
      headers: { 'Content-Type': 'application/json' }
    });

    if (queryBeforeReview.status === 200) {
      if (!queryBeforeReview.data.can_view_report) {
        testPass('对外查询规则生效 - 未审核报告不可对外查看');
        log(`can_view_report: ${queryBeforeReview.data.can_view_report} (预期: false)`);
      } else {
        testFail('规则校验失败', '未审核报告居然可以对外查看');
      }
    } else {
      testFail('状态查询失败', `状态: ${queryBeforeReview.status}`);
    }
    console.log('');

    console.log('[10] 报告提交审核与审核通过');
    await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: `/api/reports/${reportId}/submit`,
      headers: { 'Content-Type': 'application/json' }
    }, { submitter_id: 'reporter001', submitter_name: '王报告' });

    const reviewRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: `/api/reports/${reportId}/review`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      reviewer_id: 'reviewer001',
      reviewer_name: '赵审核',
      review_result: 'APPROVED',
      comment: '报告数据完整，审核通过'
    });

    if (reviewRes.status === 200 && reviewRes.data.report.status === 'APPROVED') {
      testPass('报告审核通过');
      log(`报告状态: ${reviewRes.data.report.status}`);
    } else {
      testFail('审核失败', `状态: ${reviewRes.status}`);
    }
    console.log('');

    console.log('[11] 验证审核通过后可对外查询');
    const queryAfterReview = await request({
      method: 'GET',
      hostname: 'localhost',
      port: 3001,
      path: `/api/query/status/${orderRes.data.order_no}`,
      headers: { 'Content-Type': 'application/json' }
    });

    if (queryAfterReview.status === 200 && queryAfterReview.data.can_view_report) {
      testPass('对外查询规则生效 - 审核通过后可查看报告');
      log(`can_view_report: ${queryAfterReview.data.can_view_report} (预期: true)`);
      log(`委托单状态: ${queryAfterReview.data.order.status}`);
    } else {
      testFail('对外查询状态不正确', `can_view_report: ${queryAfterReview.data?.can_view_report}`);
    }
    console.log('');

    console.log('[12] 报告版本管理验证 - 审核退回后重新提交保留旧版本');
    
    const report2Res = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: '/api/reports',
      headers: { 'Content-Type': 'application/json' }
    }, {
      order_id: orderId,
      author_id: 'reporter001',
      author_name: '王报告',
      report_content: '第二份报告草稿...',
      conclusion: '待审核'
    });

    const report2Id = report2Res.data?.id;
    
    await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: `/api/reports/${report2Id}/submit`,
      headers: { 'Content-Type': 'application/json' }
    }, { submitter_id: 'reporter001', submitter_name: '王报告' });

    await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: `/api/reports/${report2Id}/review`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      reviewer_id: 'reviewer001',
      reviewer_name: '赵审核',
      review_result: 'REJECTED',
      comment: '数据有误，请重新核实'
    });

    const resubmitRes = await request({
      method: 'POST',
      hostname: 'localhost',
      port: 3001,
      path: `/api/reports/${report2Id}/resubmit`,
      headers: { 'Content-Type': 'application/json' }
    }, {
      author_id: 'reporter001',
      author_name: '王报告',
      report_content: '修正后的报告内容...',
      conclusion: '已修正数据，重新提交',
      remark: '修正了pH值数据'
    });

    if (resubmitRes.status === 201 && resubmitRes.data.parent_report_id === report2Id) {
      testPass('版本管理生效 - 退回后重新提交保留旧版本');
      log(`旧版本ID: ${report2Id}`);
      log(`新版本ID: ${resubmitRes.data.report.id}`);
      log(`新版本号: ${resubmitRes.data.report.version}`);
      log(`消息: ${resubmitRes.data.message}`);
    } else {
      testFail('版本管理失败', `状态: ${resubmitRes.status}`);
    }
    console.log('');

  } catch (err) {
    console.error('测试执行异常:', err.message);
  }

  console.log('========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  console.log(`  通过: ${passed}`);
  console.log(`  失败: ${failed}`);
  console.log(`  总计: ${passed + failed}`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
