import { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, DatePicker, Input, Button, Row, Col, Statistic, message, Tabs } from 'antd';
import { WarningOutlined, FileTextOutlined, ExperimentOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { getAbnormalDashboard } from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const AbnormalDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    client_name: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.client_name) params.client_name = filters.client_name;
      
      const res = await getAbnormalDashboard(params);
      setData(res.data);
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载异常看板数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDateChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        start_date: dates[0]?.format('YYYY-MM-DD') || '',
        end_date: dates[1]?.format('YYYY-MM-DD') || ''
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        start_date: '',
        end_date: ''
      }));
    }
  };

  const sampleColumns = [
    { title: '委托单号', dataIndex: 'order_no', key: 'order_no', width: 140, fixed: 'left' },
    { title: '客户名称', dataIndex: 'client_name', key: 'client_name', width: 120 },
    { title: '样品瓶号', dataIndex: 'vial_no', key: 'vial_no', width: 120 },
    { title: '条码', dataIndex: 'vial_barcode', key: 'vial_barcode', width: 120 },
    { title: '样品名称', dataIndex: 'sample_name', key: 'sample_name', width: 120 },
    { title: '样品类型', dataIndex: 'sample_type', key: 'sample_type', width: 100 },
    { title: '异常原因', dataIndex: 'abnormal_reason', key: 'abnormal_reason', width: 200, ellipsis: true },
    { title: '收样异常原因', dataIndex: 'receipt_abnormal_reason', key: 'receipt_abnormal_reason', width: 200, ellipsis: true },
    { title: '收样人', dataIndex: 'receiver_name', key: 'receiver_name', width: 100 },
    { title: '委托日期', dataIndex: 'commission_date', key: 'commission_date', width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
    },
    { title: '委托单状态', dataIndex: 'order_status', key: 'order_status', width: 100,
      render: (s: string) => <Tag color="orange">{s}</Tag>
    }
  ];

  const itemColumns = [
    { title: '委托单号', dataIndex: 'order_no', key: 'order_no', width: 140, fixed: 'left' },
    { title: '客户名称', dataIndex: 'client_name', key: 'client_name', width: 120 },
    { title: '样品瓶号', dataIndex: 'vial_no', key: 'vial_no', width: 120 },
    { title: '样品名称', dataIndex: 'sample_name', key: 'sample_name', width: 120 },
    { title: '项目编码', dataIndex: 'item_code', key: 'item_code', width: 120 },
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name', width: 150 },
    { title: '检测标准', dataIndex: 'test_standard', key: 'test_standard', width: 150 },
    { title: '结果值', dataIndex: 'result_value', key: 'result_value', width: 100 },
    { title: '备注', dataIndex: 'item_remark', key: 'item_remark', width: 200, ellipsis: true }
  ];

  const tabItems = [
    {
      key: 'samples',
      label: `异常样品 (${data?.abnormal_samples?.length || 0})`,
      children: (
        <Table
          columns={sampleColumns}
          dataSource={data?.abnormal_samples || []}
          rowKey="id"
          size="small"
          scroll={{ x: 1600, y: 500 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      )
    },
    {
      key: 'items',
      label: `异常检测项目 (${data?.abnormal_test_items?.length || 0})`,
      children: (
        <Table
          columns={itemColumns}
          dataSource={data?.abnormal_test_items || []}
          rowKey="id"
          size="small"
          scroll={{ x: 1400, y: 500 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      )
    }
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="异常样品数"
                value={data?.stats?.abnormal_sample_count || 0}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="异常项目数"
                value={data?.stats?.abnormal_item_count || 0}
                prefix={<ExperimentOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="异常收样数"
                value={data?.stats?.abnormal_receipt_count || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="影响委托单数"
                value={data?.stats?.affected_order_count || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="筛选条件" size="small">
        <Space size="middle" wrap>
          <RangePicker
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
          />
          <Input
            placeholder="客户名称"
            style={{ width: 200 }}
            value={filters.client_name}
            onChange={e => setFilters(prev => ({ ...prev, client_name: e.target.value }))}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData} loading={loading}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setFilters({ start_date: '', end_date: '', client_name: '' });
            loadData();
          }}>
            重置
          </Button>
        </Space>
      </Card>

      <Card title="异常详情" loading={loading}>
        <Tabs items={tabItems} defaultActiveKey="samples" />
      </Card>
    </Space>
  );
};

export default AbnormalDashboard;
