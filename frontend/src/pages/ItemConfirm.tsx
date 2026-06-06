import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, message, Checkbox, Space, Alert, Input } from 'antd';
import { ScanOutlined, CheckOutlined } from '@ant-design/icons';
import api from '../api';

const ItemConfirm = () => {
  const [vials, setVials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVial, setSelectedVial] = useState<any>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  const fetchVials = async () => {
    setLoading(true);
    try {
      const res = await api.get('/samples', { params: { status: 'RECEIVED,ITEMS_CONFIRMED,ABNORMAL' } });
      setVials(res.data);
    } catch (error) {
      message.error('获取样品列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVials();
  }, []);

  const handleScan = async () => {
    if (!barcodeInput) {
      message.warning('请输入条码');
      return;
    }
    try {
      const res = await api.get(`/samples/barcode/${barcodeInput}`);
      const vial = res.data;
      if (vial.status === 'PENDING') {
        message.error('该样品尚未收样，请先完成收样');
        return;
      }
      if (vial.status === 'ABNORMAL') {
        message.error('该样品为异常样品，无法确认检测项目');
        return;
      }
      setSelectedVial(vial);
      setCheckedItems(vial.testItems?.map((t: any) => t.id) || []);
    } catch (error: any) {
      message.error(error.response?.data?.error || '未找到样品');
    }
  };

  const handleConfirm = async () => {
    if (!selectedVial) return;
    try {
      await api.post(`/samples/${selectedVial.id}/items/confirm`, {
        item_ids: checkedItems,
        operator_id: 'admin001',
        operator_name: '系统管理员'
      });
      message.success('检测项目确认成功');
      setSelectedVial(null);
      setCheckedItems([]);
      setBarcodeInput('');
      fetchVials();
    } catch (error: any) {
      message.error(error.response?.data?.error || '确认失败');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'default',
      RECEIVED: 'blue',
      ITEMS_CONFIRMED: 'green',
      ABNORMAL: 'orange'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待收样',
      RECEIVED: '已收样',
      ITEMS_CONFIRMED: '项目已确认',
      ABNORMAL: '异常'
    };
    return texts[status] || status;
  };

  const getItemStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待确认',
      CONFIRMED: '已确认',
      ASSIGNED: '已分派'
    };
    return texts[status] || status;
  };

  const columns = [
    { title: '样品瓶号', dataIndex: 'vial_no', key: 'vial_no' },
    { title: '条码', dataIndex: 'vial_barcode', key: 'vial_barcode' },
    { title: '样品名称', dataIndex: 'sample_name', key: 'sample_name' },
    { title: '保存条件', dataIndex: 'storage_condition', key: 'storage_condition' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={getStatusColor(s)}>{getStatusText(s)}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" disabled={record.status === 'PENDING' || record.status === 'ABNORMAL'} onClick={() => {
          setSelectedVial(record);
          api.get(`/samples/barcode/${record.vial_barcode}`).then(res => {
            setSelectedVial(res.data);
            setCheckedItems(res.data.testItems?.map((t: any) => t.id) || []);
          });
        }}>
          确认项目
        </Button>
      )
    }
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="检测项目确认">
        <Space style={{ marginBottom: 16 }}>
          <Input
            size="large"
            placeholder="扫描或输入样品条码"
            prefix={<ScanOutlined />}
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onPressEnter={handleScan}
            style={{ width: 300 }}
          />
          <Button type="primary" size="large" onClick={handleScan}>扫描加载</Button>
        </Space>

        <Table columns={columns} dataSource={vials} rowKey="id" loading={loading} size="small" />
      </Card>

      {selectedVial && (
        <Card title={`确认检测项目 - ${selectedVial.sample_name}`} extra={<Button onClick={() => setSelectedVial(null)}>关闭</Button>}>
          <Alert
            message={`样品状态：${getStatusText(selectedVial.status)}`}
            type={selectedVial.status === 'ITEMS_CONFIRMED' ? 'success' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Card type="inner" title="检测项目列表" size="small">
            <Checkbox
              checked={checkedItems.length === selectedVial.testItems?.length}
              indeterminate={checkedItems.length > 0 && checkedItems.length < selectedVial.testItems?.length}
              onChange={e => {
                if (e.target.checked) {
                  setCheckedItems(selectedVial.testItems?.map((t: any) => t.id) || []);
                } else {
                  setCheckedItems([]);
                }
              }}
            >
              全选
            </Checkbox>
            <div style={{ marginTop: 12 }}>
              {selectedVial.testItems?.map((item: any) => (
                <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Checkbox
                    checked={checkedItems.includes(item.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setCheckedItems([...checkedItems, item.id]);
                      } else {
                        setCheckedItems(checkedItems.filter(id => id !== item.id));
                      }
                    }}
                  >
                    <span style={{ marginLeft: 8 }}>{item.item_code} - {item.item_name}</span>
                    {item.test_standard && <span style={{ color: '#999', marginLeft: 16 }}>标准：{item.test_standard}</span>}
                    <Tag style={{ marginLeft: 16 }}>{getItemStatusText(item.status)}</Tag>
                  </Checkbox>
                </div>
              ))}
            </div>
          </Card>
          
          <Button
            type="primary"
            icon={<CheckOutlined />}
            style={{ marginTop: 16 }}
            onClick={handleConfirm}
            disabled={checkedItems.length === 0}
            block
            size="large"
          >
            确认选中的检测项目 ({checkedItems.length} 项)
          </Button>
        </Card>
      )}
    </Space>
  );
};

export default ItemConfirm;
