# LIMS 实验室样品委托系统

完整的实验室样品委托管理全栈应用，支持从委托提交到报告审核的全流程管理。

## 功能模块

### 前端页面
- **委托详情**: 委托单创建、查看，支持多样品和多检测项目
- **扫码收样**: 条码扫描、样品接收、保存条件检查、异常收样
- **项目确认**: 检测项目确认，支持批量选择
- **分派台**: 检测任务分派，支持单条/批量分派
- **报告审核**: 报告草稿、提交审核、审核退回/通过、版本管理
- **状态查询**: 委托单进度跟踪、状态历史、对外查询控制

### 后端 API
- 委托单管理 (CRUD + 状态流转)
- 样品瓶管理 (扫码、收样、异常处理)
- 检测项目管理 (确认、分派)
- 任务分派 (分派规则校验)
- 报告管理 (草稿、审核、版本)
- 状态查询 (对外查询控制)

## 业务规则

1. **样品未收样不能分派检测**: 只有已收样且正常的样品才能分派检测任务
2. **保存条件不满足必须转异常收样**: 条件检查不通过时，样品标记为异常状态
3. **报告草稿未审核不能对外查询**: 只有审核通过的报告才能在对外查询中查看
4. **审核退回后重新提交保留旧版本**: 退回修改后重新提交会生成新版本，旧版本保留

## 数据库表结构

- `commission_orders` - 委托单
- `sample_vials` - 样品瓶
- `test_items` - 检测项目
- `sample_receipts` - 收样记录
- `task_assignments` - 任务分派
- `report_drafts` - 报告草稿
- `review_comments` - 审核意见
- `status_history` - 状态历史

## 快速启动

### 方式一: Docker Compose (推荐)

```bash
docker-compose up -d
```

服务启动后:
- 前端: http://localhost:8080
- 后端API: http://localhost:3001
- 健康检查: http://localhost:3001/health

查看容器状态:
```bash
docker-compose ps
```

查看日志:
```bash
docker-compose logs -f
```

### 方式二: 本地开发启动

```bash
chmod +x start.sh
./start.sh
```

或手动启动:

```bash
# 安装后端依赖
cd backend
npm install

# 启动后端
npm start
```

后端启动后，新开终端启动前端:

```bash
cd frontend
npm install
npm run dev
```

访问:
- 前端: http://localhost:3000
- 后端: http://localhost:3001

## 验收测试

执行验收测试脚本:

```bash
cd backend
npm test
```

测试内容包括:
1. 数据库健康检查
2. 委托单创建与详情查询
3. **未收样直接分派验证规则错误**
4. **异常收样状态流转检查**
5. 异常样品不能分派验证
6. 状态历史记录验证
7. 报告创建与审核流程
8. 未审核报告不能对外查询验证
9. 审核通过后可对外查询验证
10. **报告版本管理验证**

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Ant Design
- **后端**: Node.js + Express + SQLite3
- **容器化**: Docker + Docker Compose
- **数据持久化**: Docker Volume
