import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, message, Modal, Form, Select, Input, Space, Alert, Timeline, Divider } from 'antd';
import { FileSearchOutlined, CheckCircleOutlined, CloseCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const ReportReview = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [resubmitModal, setResubmitModal] = useState(false);
  const [form] = Form.useForm();
  const [resubmitForm] = Form.useForm();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (error) {
      message.error('获取报告列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const viewReport = async (id: string) => {
    try {
      const res = await api.get(`/reports/${id}`);
      setSelectedReport(res.data);
    } catch (error) {
      message.error('获取报告详情失败');
    }
  };

  const submitForReview = async (id: string) => {
    try {
      await api.post(`/reports/${id}/submit`, {
        submitter_id: 'admin001',
        submitter_name: '系统管理员'
      });
      message.success('报告已提交审核');
      fetchReports();
    } catch (error: any) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const handleReview = async (values: any) => {
    try {
      await api.post(`/reports/${selectedReport.id}/review`, {
        reviewer_id: 'admin001',
        reviewer_name: '系统管理员',
        review_result: values.review_result,
        comment: values.comment
      });
      message.success('审核完成');
      setReviewModal(false);
      form.resetFields();
      setSelectedReport(null);
      fetchReports();
    } catch (error: any) {
      message.error(error.response?.data?.error || '审核失败');
    }
  };

  const handleResubmit = async (values: any) => {
    try {
      await api.post(`/reports/${selectedReport.id}/resubmit`, {
        author_id: 'admin001',
        author_name: '系统管理员',
        report_content: values.report_content,
        conclusion: values.conclusion,
        remark: values.remark
      });
      message.success('报告已重新提交，旧版本已保留');
      setResubmitModal(false);
      resubmitForm.resetFields();
      setSelectedReport(null);
      fetchReports();
    } catch (error: any) {
      message.error(error.response?.data?.error || '重新提交失败');
    }
  };

  const createDraft = async () => {
    try {
      const commissions = await api.get('/commissions', { params: { status: 'ASSIGNED' } });
      if (commissions.data.length === 0) {
        message.warning('暂无可生成报告的委托单');
        return;
      }
      const order = commissions.data[0];
      await api.post('/reports', {
        order_id: order.id,
        author_id: 'admin001',
        author_name: '系统管理员',
        report_content: '报告内容示例...',
        conclusion: '检测结论示例...'
      });
      message.success('报告草稿创建成功');
      fetchReports();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'default',
      PENDING_REVIEW: 'gold',
      APPROVED: 'green',
      REJECTED: 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      DRAFT: '草稿',
      PENDING_REVIEW: '待审核',
      APPROVED: '已审核通过',
      REJECTED: '审核退回'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: '报告编号', dataIndex: 'report_no', key: 'report_no' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '委托单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '委托人', dataIndex: 'client_name', key: 'client_name' },
    { title: '创建人', dataIndex: 'author_name', key: 'author_name' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={getStatusColor(s)}>{getStatusText(s)}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => viewReport(record.id)}>查看</Button>
          {record.status === 'DRAFT' && (
            <Button type="link" onClick={() => submitForReview(record.id)}>提交审核</Button>
          )}
          {record.status === 'REJECTED' && (
            <Button type="link" onClick={() => {
              viewReport(record.id);
              setTimeout(() => setResubmitModal(true), 300);
            }}>重新提交</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <Card
      title="报告审核"
      extra={
        <Space>
          <Button icon={<FileSearchOutlined />} onClick={createDraft}>新建报告草稿</Button>
          <Button icon={<HistoryOutlined />}>版本历史</Button>
        </Space>
      }
    >
      <Alert
        message="审核规则"
        description="1. 报告草稿需提交后才能审核；2. 审核通过前报告不能对外查询；3. 审核退回后重新提交会保留旧版本"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} />

      <Modal
        title="报告详情"
        open={!!selectedReport && !reviewModal && !resubmitModal}
        onCancel={() => setSelectedReport(null)}
        width={700}
        footer={
          selectedReport?.status === 'PENDING_REVIEW' ? (
            <Button type="primary" onClick={() => {
              setReviewModal(true);
              form.setFieldsValue({ review_result: 'APPROVED' });
            }}>开始审核</Button>
          ) : null
        }
      >
        {selectedReport && (
          <div>
            <p><strong>报告编号：</strong>{selectedReport.report_no} <Tag>版本 {selectedReport.version}</Tag></p>
            <p><strong>委托单号：</strong>{selectedReport.order_no}</p>
            <p><strong>状态：</strong><Tag color={getStatusColor(selectedReport.status)}>{getStatusText(selectedReport.status)}</Tag></p>
            <Divider />
            <h4>报告内容</h4>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
              {selectedReport.report_content || '暂无内容'}
            </div>
            <h4 style={{ marginTop: 16 }}>检测结论</h4>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
              {selectedReport.conclusion || '暂无结论'}
            </div>
            <Divider />
            <h4>审核记录</h4>
            <Timeline>
              {selectedReport.reviews?.map((r: any) => (
                <Timeline.Item key={r.id} color={r.review_result === 'APPROVED' ? 'green' : 'red'}>
                  <p><strong>{r.reviewer_name}</strong> - {r.review_result === 'APPROVED' ? '审核通过' : '审核退回'}</p>
                  <p style={{ color: '#666' }}>{r.comment}</p>
                  <p style={{ color: '#999', fontSize: 12 }}>{dayjs(r.review_time).format('YYYY-MM-DD HH:mm')}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Modal>

      <Modal title="审核报告" open={reviewModal} onCancel={() => setReviewModal(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleReview}>
          <Form.Item name="review_result" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Option value="APPROVED"><CheckCircleOutlined /> 审核通过</Option>
              <Option value="REJECTED"><CloseCircleOutlined /> 审核退回</Option>
            </Select>
          </Form.Item>
          <Form.Item name="comment" label="审核意见">
            <TextArea rows={4} placeholder="请输入审核意见..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>确认审核</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="重新提交报告（保留旧版本）" open={resubmitModal} onCancel={() => setResubmitModal(false)} footer={null} width={600}>
        <Form form={resubmitForm} layout="vertical" onFinish={handleResubmit}>
          <Alert
            message="旧版本将被保留"
            description="重新提交后，系统会生成新版本号，旧版本报告仍可在版本历史中查看"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item name="report_content" label="报告内容" initialValue={selectedReport?.report_content}>
            <TextArea rows={6} />
          </Form.Item>
          <Form.Item name="conclusion" label="检测结论" initialValue={selectedReport?.conclusion}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="remark" label="修改说明">
            <TextArea rows={2} placeholder="请说明修改内容..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交新版本</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ReportReview;
