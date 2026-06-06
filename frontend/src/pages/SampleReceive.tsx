import { useState } from 'react';
import { Card, Form, Input, Button, Select, Switch, message, Tag, Descriptions, Space, Alert } from 'antd';
import { ScanOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const SampleReceive = () => {
  const [form] = Form.useForm();
  const [scanned, setScanned] = useState<any>(null);
  const [receiptResult, setReceiptResult] = useState<any>(null);

  const handleScan = async (barcode: string) => {
    if (!barcode) {
      message.warning('请输入或扫描条码');
      return;
    }
    try {
      const res = await api.get(`/samples/barcode/${barcode}`);
      setScanned(res.data);
      setReceiptResult(null);
      form.setFieldsValue({
        storage_condition: res.data.storage_condition
      });
    } catch (error: any) {
      message.error(error.response?.data?.error || '未找到该样品');
      setScanned(null);
    }
  };

  const handleReceive = async (values: any) => {
    if (!scanned) {
      message.warning('请先扫描样品条码');
      return;
    }
    try {
      const payload = {
        vial_barcode: scanned.vial_barcode,
        receiver_id: 'admin001',
        receiver_name: '系统管理员',
        condition_check_passed: values.condition_check_passed,
        condition_remark: values.condition_remark,
        is_abnormal: values.is_abnormal || !values.condition_check_passed,
        abnormal_reason: values.abnormal_reason,
        remark: values.remark
      };
      const res = await api.post('/samples/receive', payload);
      setReceiptResult(res.data);
      message.success('收样成功');
      setScanned(null);
      form.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || '收样失败');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'default',
      RECEIVED: 'green',
      ABNORMAL: 'orange'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待收样',
      RECEIVED: '已收样',
      ABNORMAL: '异常收样'
    };
    return texts[status] || status;
  };

  return (
    <Card title="扫码收样">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card size="small" title="扫描样品条码">
          <Form layout="inline" onFinish={(values) => handleScan(values.barcode)}>
            <Form.Item name="barcode" rules={[{ required: true, message: '请输入条码' }]}>
              <Input size="large" placeholder="扫描或输入样品瓶条码" prefix={<ScanOutlined />} style={{ width: 300 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" size="large" htmlType="submit">扫描</Button>
            </Form.Item>
          </Form>
        </Card>

        {scanned && (
          <>
            <Alert
              message={`样品信息已加载 - ${scanned.sample_name}`}
              description={`当前状态：${getStatusText(scanned.status)}`}
              type={scanned.status === 'PENDING' ? 'info' : 'warning'}
              showIcon
            />
            
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="样品瓶号">{scanned.vial_no}</Descriptions.Item>
              <Descriptions.Item label="条码">{scanned.vial_barcode}</Descriptions.Item>
              <Descriptions.Item label="样品名称">{scanned.sample_name}</Descriptions.Item>
              <Descriptions.Item label="委托单号">{scanned.order?.order_no}</Descriptions.Item>
              <Descriptions.Item label="委托人">{scanned.order?.client_name}</Descriptions.Item>
              <Descriptions.Item label="保存条件"><Tag>{scanned.storage_condition}</Tag></Descriptions.Item>
              <Descriptions.Item label="当前状态" span={2}>
                <Tag color={getStatusColor(scanned.status)}>{getStatusText(scanned.status)}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {scanned.status === 'PENDING' && (
              <Card size="small" title="收样登记">
                <Form form={form} layout="vertical" onFinish={handleReceive}>
                  <Form.Item name="condition_check_passed" label="保存条件检查" valuePropName="checked" initialValue={true}>
                    <Switch checkedChildren={<CheckCircleOutlined />} unCheckedChildren={<ExclamationCircleOutlined />} />
                  </Form.Item>
                  <Form.Item name="is_abnormal" label="是否异常收样" valuePropName="checked" initialValue={false}>
                    <Switch />
                  </Form.Item>
                  <Form.Item name="condition_remark" label="条件检查备注">
                    <TextArea rows={2} placeholder="保存条件检查情况说明" />
                  </Form.Item>
                  <Form.Item name="abnormal_reason" label="异常原因">
                    <TextArea rows={2} placeholder="如样品泄漏、温度异常等" />
                  </Form.Item>
                  <Form.Item name="remark" label="备注">
                    <TextArea rows={2} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" block size="large">确认收样</Button>
                  </Form.Item>
                </Form>
              </Card>
            )}
          </>
        )}

        {receiptResult && (
          <Alert
            message="收样成功"
            description={`收样单号：${receiptResult.receipt.receipt_no}，时间：${dayjs(receiptResult.receipt.receipt_time).format('YYYY-MM-DD HH:mm:ss')}`}
            type="success"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
};

export default SampleReceive;
