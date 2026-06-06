import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, message, Modal, Form, Select, Input, Space, Alert, Checkbox } from 'antd';
import { UserOutlined, SendOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;
const { TextArea } = Input;

const testers = [
  { id: 'tester001', name: '张三' },
  { id: 'tester002', name: '李四' },
  { id: 'tester003', name: '王五' },
  { id: 'tester004', name: '赵六' }
];

const AssignmentDesk = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [assignModal, setAssignModal] = useState(false);
  const [form] = Form.useForm();
  const [batchAssign, setBatchAssign] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/test-items');
      setItems(res.data);
    } catch (error) {
      message.error('获取检测项目失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAssign = async (values: any) => {
    const assignData = batchAssign ? {
      item_ids: selectedRowKeys,
      assigner_id: 'admin001',
      assigner_name: '系统管理员',
      assignee_id: values.tester_id,
      assignee_name: testers.find(t => t.id === values.tester_id)?.name,
      deadline: values.deadline,
      priority: values.priority || 'NORMAL'
    } : {
      item_id: selectedRowKeys[0],
      assigner_id: 'admin001',
      assigner_name: '系统管理员',
      assignee_id: values.tester_id,
      assignee_name: testers.find(t => t.id === values.tester_id)?.name,
      deadline: values.deadline,
      priority: values.priority || 'NORMAL',
      remark: values.remark
    };

    try {
      if (batchAssign) {
        await api.post('/assignments/batch', assignData);
      } else {
        await api.post('/assignments', assignData);
      }
      message.success('任务分派成功');
      setAssignModal(false);
      form.resetFields();
      setSelectedRowKeys([]);
      fetchItems();
    } catch (error: any) {
      const errData = error.response?.data;
      if (errData?.rule_code === 'SAMPLE_NOT_RECEIVED') {
        Modal.error({
          title: '规则校验失败',
          content: (
            <div>
              <p><strong>错误码：</strong>{errData.rule_code}</p>
              <p><strong>详细信息：</strong>{errData.detail}</p>
            </div>
          )
        });
      } else {
        message.error(errData?.error || '分派失败');
      }
    }
  };

  const openAssignModal = (batch: boolean) => {
    setBatchAssign(batch);
    setAssignModal(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'default',
      CONFIRMED: 'blue',
      ASSIGNED: 'purple',
      COMPLETED: 'green'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待确认',
      CONFIRMED: '待分派',
      ASSIGNED: '已分派',
      COMPLETED: '已完成'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: '委托单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '样品瓶号', dataIndex: 'vial_no', key: 'vial_no' },
    { title: '样品名称', dataIndex: 'sample_name', key: 'sample_name' },
    { title: '项目编码', dataIndex: 'item_code', key: 'item_code' },
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={getStatusColor(s)}>{getStatusText(s)}</Tag> },
    { title: '检测人员', dataIndex: 'tester_name', key: 'tester_name' }
  ];

  const canAssign = (record: any) => {
    return record.status === 'CONFIRMED';
  };

  const availableItems = items.filter(item => canAssign(item));

  return (
    <Card
      title="任务分派台"
      extra={
        <Space>
          <span style={{ marginRight: 16 }}>可分派：<Tag color="blue">{availableItems.length}</Tag>
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={() => openAssignModal(selectedRowKeys.length > 1)}
          >
            分派任务 ({selectedRowKeys.length})
          </Button>
        </Space>
      }
    >
      <Alert
        message="分派规则"
        description="1. 只有已收样且已确认项目的检测任务才能分派；2. 未收样样品不能分派；3. 异常样品不能分派"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
          getCheckboxProps: (record: any) => ({
            disabled: !canAssign(record)
          })
        }}
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={batchAssign ? `批量分派任务 (${selectedRowKeys.length} 项)` : '分派任务'}
        open={assignModal}
        onCancel={() => setAssignModal(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleAssign}>
          <Form.Item name="tester_id" label="分派给" rules={[{ required: true, message: '请选择检测人员' }]}>
            <Select placeholder="请选择检测人员">
              {testers.map(t => (
                <Option key={t.id} value={t.id}>{t.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="NORMAL">
            <Select>
              <Option value="LOW">低</Option>
              <Option value="NORMAL">普通</Option>
              <Option value="HIGH">高</Option>
              <Option value="URGENT">紧急</Option>
            </Select>
          </Form.Item>
          <Form.Item name="deadline" label="截止日期">
            <Input type="date" />
          </Form.Item>
          {!batchAssign && (
            <Form.Item name="remark" label="备注">
              <TextArea rows={2} />
            </Form.Item>
          )}
          <Form.Item>
            <Button type="primary" htmlType="submit" block>确认分派</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AssignmentDesk;
