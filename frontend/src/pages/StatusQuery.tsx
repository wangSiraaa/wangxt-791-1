import { useState } from 'react';
import { Card, Input, Button, Tag, Timeline, Descriptions, Space, Alert, Table, message, Row, Col, Statistic } from 'antd';
import { SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined, ExperimentOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const StatusQuery = () => {
  const [orderNo, setOrderNo] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const handleQuery = async () => {
    if (!orderNo) {
      message.warning('请输入委托单号');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/query/status/${orderNo}`);
      setQueryResult(res.data);
      message.success('查询成功');
    } catch (error: any) {
      message.error(error.response?.data?.error || '查询失败');
      setQueryResult(null);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/query/dashboard/stats');
      setStats(res.data);
    } catch (error) {
      console.error('加载统计失败');
    }
  };

  useState(() => {
    loadStats();
  }, []);

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

  const getSampleStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待收样',
      RECEIVED: '已收样',
      ITEMS_CONFIRMED: '项目已确认',
      ASSIGNED: '已分派',
      ABNORMAL: '异常'
    };
    return texts[status] || status;
  };

  const getItemStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待确认',
      CONFIRMED: '已确认',
      ASSIGNED: '已分派',
      COMPLETED: '已完成'
    };
    return texts[status] || status;
  };

  const vialColumns = [
    { title: '瓶号', dataIndex: 'vial_no', key: 'vial_no', width: 120 },
    { title: '样品名称', dataIndex: 'sample_name', key: 'sample_name' },
    { title: '条码', dataIndex: 'vial_barcode', key: 'vial_barcode' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{getSampleStatusText(s)}</Tag> }
  ];

  const itemColumns = [
    { title: '项目编码', dataIndex: 'item_code', key: 'item_code', width: 100 },
    { title: '项目名称', dataIndex: 'item_name', key: 'item_name' },
    { title: '检测人员', dataIndex: 'tester_name', key: 'tester_name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{getItemStatusText(s)}</Tag> }
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {stats && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic title="委托单总数" value={stats.orders?.reduce((a: number, b: any) => a + b.count, 0) || 0} prefix={<FileTextOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="样品总数" value={stats.samples?.reduce((a: number, b: any) => a + b.count, 0) || 0} prefix={<ExperimentOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="检测中" value={stats.test_items?.filter((i: any) => i.status === 'ASSIGNED').reduce((a: number, b: any) => a + b.count, 0) || 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="已完成" value={stats.orders?.filter((o: any) => o.status === 'COMPLETED').reduce((a: number, b: any) => a + b.count, 0) || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="状态查询">
        <Space.Compact style={{ width: '100%', maxWidth: 500, marginBottom: 24 }}>
          <Input
            size="large"
            placeholder="请输入委托单号，如：WT2024..."
            value={orderNo}
            onChange={e => setOrderNo(e.target.value)}
            onPressEnter={handleQuery}
          />
          <Button type="primary" size="large" icon={<SearchOutlined />} onClick={handleQuery} loading={loading}>
            查询
          </Button>
        </Space.Compact>

        {queryResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message={queryResult.can_view_report ? '报告可查看' : '报告暂不可对外查询'}
              description={queryResult.can_view_report 
                ? '该委托单报告已审核通过，可以对外查询' 
                : '请等待报告审核完成后再查询'}
              type={queryResult.can_view_report ? 'success' : 'info'}
              showIcon
            />

            <Descriptions bordered title="委托单信息" column={2}>
              <Descriptions.Item label="委托单号">{queryResult.order.order_no}</Descriptions.Item>
              <Descriptions.Item label="委托人">{queryResult.order.client_name}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={getStatusColor(queryResult.order.status)}>{getStatusText(queryResult.order.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="委托日期">
                {dayjs(queryResult.order.commission_date).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Table title={() => '样品列表'} columns={vialColumns} dataSource={queryResult.vials} rowKey="id" size="small" pagination={false} />

            <Table title={() => '检测项目'} columns={itemColumns} dataSource={queryResult.test_items} rowKey="id" size="small" pagination={false} />

            <Card title="状态流转历史" size="small">
              <Timeline>
                {queryResult.status_history?.map((h: any, idx: number) => (
                  <Timeline.Item key={idx}>
                    {h.old_status && <><Tag>{getStatusText(h.old_status)}</Tag> → </>}
                    <Tag color="blue">{getStatusText(h.new_status)}</Tag>
                    <span style={{ marginLeft: 8 }}>
                      {h.operator_name} - {dayjs(h.operation_time).format('YYYY-MM-DD HH:mm')}
                    </span>
                    {h.remark && <p style={{ color: '#666', marginTop: 4 }}>{h.remark}</p>}
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Space>
        )}
      </Card>
    </Space>
  );
};

export default StatusQuery;
