import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, message, Timeline, Divider } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface TestItem {
  id?: string;
  item_code: string;
  item_name: string;
  test_standard?: string;
  required_condition?: string;
}

interface Sample {
  id?: string;
  sample_name: string;
  sample_type?: string;
  storage_condition: string;
  sample_quantity?: number;
  sample_unit?: string;
  collection_date?: string;
  collection_location?: string;
  vial_barcode?: string;
  remark?: string;
  test_items: TestItem[];
}

const CommissionDetail = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [form] = Form.useForm();
  const [samples, setSamples] = useState<Sample[]>([{ sample_name: '', storage_condition: '常温', test_items: [] }]);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/commissions');
      setCommissions(res.data);
    } catch (error) {
      message.error('获取委托单列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCommissions();
  }, []);

  const viewDetail = async (id: string) => {
    try {
      const res = await api.get(`/commissions/${id}`);
      setSelectedDetail(res.data);
      setDetailVisible(true);
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        ...values,
        samples: samples.map(s => ({
          ...s,
          test_items: s.test_items
        }))
      };
      await api.post('/commissions', payload);
      message.success('委托单创建成功');
      setCreateVisible(false);
      form.resetFields();
      setSamples([{ sample_name: '', storage_condition: '常温', test_items: [] }]);
      fetchCommissions();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const addSample = () => {
    setSamples([...samples, { sample_name: '', storage_condition: '常温', test_items: [] }]);
  };

  const removeSample = (index: number) => {
    const newSamples = samples.filter((_, i) => i !== index);
    setSamples(newSamples);
  };

  const updateSample = (index: number, field: string, value: any) => {
    const newSamples = [...samples];
    (newSamples[index] as any)[field] = value;
    setSamples(newSamples);
  };

  const addTestItem = (sampleIndex: number) => {
    const newSamples = [...samples];
    newSamples[sampleIndex].test_items.push({ item_code: '', item_name: '' });
    setSamples(newSamples);
  };

  const removeTestItem = (sampleIndex: number, itemIndex: number) => {
    const newSamples = [...samples];
    newSamples[sampleIndex].test_items = newSamples[sampleIndex].test_items.filter((_, i) => i !== itemIndex);
    setSamples(newSamples);
  };

  const updateTestItem = (sampleIndex: number, itemIndex: number, field: string, value: any) => {
    const newSamples = [...samples];
    (newSamples[sampleIndex].test_items[itemIndex] as any)[field] = value;
    setSamples(newSamples);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'default',
      SUBMITTED: 'blue',
      SAMPLED: 'cyan',
      ABNORMAL: 'orange',
      ASSIGNED: 'purple',
      TESTING: 'geekblue',
      COMPLETED: 'green'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      DRAFT: '草稿',
      SUBMITTED: '已提交',
      SAMPLED: '已收样',
      ABNORMAL: '异常收样',
      ASSIGNED: '已分派',
      TESTING: '检测中',
      COMPLETED: '已完成'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: '委托单号', dataIndex: 'order_no', key: 'order_no' },
    { title: '委托人', dataIndex: 'client_name', key: 'client_name' },
    { title: '联系电话', dataIndex: 'client_phone', key: 'client_phone' },
    { title: '委托日期', dataIndex: 'commission_date', key: 'commission_date', render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm') },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={getStatusColor(s)}>{getStatusText(s)}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => viewDetail(record.id)}>查看</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="委托单管理"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建委托</Button>}
      >
        <Table columns={columns} dataSource={commissions} rowKey="id" loading={loading} />
      </Card>

      <Modal title="新建委托单" open={createVisible} width={800} onCancel={() => setCreateVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Divider orientation="left">委托信息</Divider>
          <Form.Item name="client_name" label="委托人名称" rules={[{ required: true }]}>
            <Input placeholder="请输入委托人名称" />
          </Form.Item>
          <Form.Item name="client_contact" label="联系人">
            <Input placeholder="请输入联系人" />
          </Form.Item>
          <Form.Item name="client_phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left">样品信息</Divider>
          {samples.map((sample, sIndex) => (
            <Card key={sIndex} size="small" title={`样品 ${sIndex + 1}`} style={{ marginBottom: 16 }}
              extra={<Button type="text" danger onClick={() => removeSample(sIndex)}>删除</Button>}>
              <Form.Item label="样品名称" required>
                <Input value={sample.sample_name} onChange={e => updateSample(sIndex, 'sample_name', e.target.value)} placeholder="请输入样品名称" />
              </Form.Item>
              <Form.Item label="样品类型">
                <Input value={sample.sample_type} onChange={e => updateSample(sIndex, 'sample_type', e.target.value)} placeholder="如：水质、土壤" />
              </Form.Item>
              <Form.Item label="保存条件" required>
                <Select value={sample.storage_condition} onChange={v => updateSample(sIndex, 'storage_condition', v)}>
                  <Option value="常温">常温</Option>
                  <Option value="冷藏">冷藏(2-8℃)</Option>
                  <Option value="冷冻">冷冻(-18℃)</Option>
                  <Option value="避光">避光</Option>
                </Select>
              </Form.Item>
              <Form.Item label="样品数量">
                <InputNumber value={sample.sample_quantity} onChange={v => updateSample(sIndex, 'sample_quantity', v)} />
                <span style={{ marginLeft: 8 }}>
                  <Input style={{ width: 100 }} value={sample.sample_unit} onChange={e => updateSample(sIndex, 'sample_unit', e.target.value)} placeholder="单位" />
                </span>
              </Form.Item>
              <Form.Item label="瓶身条码">
                <Input value={sample.vial_barcode} onChange={e => updateSample(sIndex, 'vial_barcode', e.target.value)} placeholder="扫描或输入条码" />
              </Form.Item>

              <Divider orientation="left" plain>检测项目</Divider>
              {sample.test_items.map((item, iIndex) => (
                <div key={iIndex} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <Input placeholder="项目编码" value={item.item_code} onChange={e => updateTestItem(sIndex, iIndex, 'item_code', e.target.value)} style={{ width: 120 }} />
                  <Input placeholder="项目名称" value={item.item_name} onChange={e => updateTestItem(sIndex, iIndex, 'item_name', e.target.value)} style={{ flex: 1 }} />
                  <Button type="text" danger onClick={() => removeTestItem(sIndex, iIndex)}>删除</Button>
                </div>
              ))}
              <Button type="dashed" block onClick={() => addTestItem(sIndex)}>添加检测项目</Button>
            </Card>
          ))}
          <Button type="dashed" block onClick={addSample} style={{ marginBottom: 16 }}>添加样品</Button>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交委托</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="委托单详情" open={detailVisible} width={900} onCancel={() => setDetailVisible(false)} footer={null}>
        {selectedDetail && (
          <div>
            <p><strong>委托单号：</strong>{selectedDetail.order_no}</p>
            <p><strong>委托人：</strong>{selectedDetail.client_name}</p>
            <p><strong>状态：</strong><Tag color={getStatusColor(selectedDetail.status)}>{getStatusText(selectedDetail.status)}</Tag></p>
            <Divider />
            <h4>样品列表</h4>
            {selectedDetail.vials?.map((vial: any) => (
              <Card key={vial.id} size="small" title={`${vial.sample_name} (${vial.vial_no})`} style={{ marginBottom: 8 }}>
                <p>保存条件：{vial.storage_condition}</p>
                <p>状态：<Tag>{vial.status}</Tag></p>
                <p>检测项目：{selectedDetail.testItems?.filter((t: any) => t.vial_id === vial.id).map((t: any) => t.item_name).join('、')}</p>
              </Card>
            ))}
            <Divider />
            <h4>状态历史</h4>
            <Timeline>
              {selectedDetail.statusHistory?.map((h: any) => (
                <Timeline.Item key={h.id}>
                  {h.old_status && <><Tag>{getStatusText(h.old_status)}</Tag> → </>}
                  <Tag color="blue">{getStatusText(h.new_status)}</Tag>
                  <span style={{ marginLeft: 8 }}>{h.operator_name} - {dayjs(h.operation_time).format('YYYY-MM-DD HH:mm')}</span>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CommissionDetail;
