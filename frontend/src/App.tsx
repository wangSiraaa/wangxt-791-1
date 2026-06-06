import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  FileTextOutlined,
  ScanOutlined,
  CheckSquareOutlined,
  UserSwitchOutlined,
  FileSearchOutlined,
  SearchOutlined,
  WarningOutlined
} from '@ant-design/icons';
import CommissionDetail from './pages/CommissionDetail';
import SampleReceive from './pages/SampleReceive';
import ItemConfirm from './pages/ItemConfirm';
import AssignmentDesk from './pages/AssignmentDesk';
import ReportReview from './pages/ReportReview';
import StatusQuery from './pages/StatusQuery';
import AbnormalDashboard from './pages/AbnormalDashboard';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/commission', icon: <FileTextOutlined />, label: <Link to="/commission">委托详情</Link> },
  { key: '/receive', icon: <ScanOutlined />, label: <Link to="/receive">扫码收样</Link> },
  { key: '/confirm', icon: <CheckSquareOutlined />, label: <Link to="/confirm">项目确认</Link> },
  { key: '/assign', icon: <UserSwitchOutlined />, label: <Link to="/assign">分派台</Link> },
  { key: '/review', icon: <FileSearchOutlined />, label: <Link to="/review">报告审核</Link> },
  { key: '/query', icon: <SearchOutlined />, label: <Link to="/query">状态查询</Link> },
  { key: '/abnormal', icon: <WarningOutlined />, label: <Link to="/abnormal">异常看板</Link> }
];

function App() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <h1 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>LIMS 实验室样品委托系统</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Content style={{ margin: '24px' }}>
          <Routes>
            <Route path="/" element={<CommissionDetail />} />
            <Route path="/commission" element={<CommissionDetail />} />
            <Route path="/receive" element={<SampleReceive />} />
            <Route path="/confirm" element={<ItemConfirm />} />
            <Route path="/assign" element={<AssignmentDesk />} />
            <Route path="/review" element={<ReportReview />} />
            <Route path="/query" element={<StatusQuery />} />
            <Route path="/abnormal" element={<AbnormalDashboard />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
