# LIMS 容器构建隔离测试用例

## 测试目标

验证 backend Docker 构建不会把宿主机 `node_modules` 带入镜像，镜像内会重新安装 `sqlite3` 依赖，并且容器启动后可通过数据库健康检查和 `npm test`。

## 测试环境

- 项目: `wangxt-791-1`
- Compose 文件: `docker-compose.yml`
- Backend 容器: `wangxt-791-lims-backend`
- Frontend 容器: `wangxt-791-lims-frontend`
- Backend 访问地址: `http://localhost:17910`
- Frontend 访问地址: `http://localhost:17911`

## TC-DOCKER-001 构建上下文隔离

前置条件:

- 本机已安装 Docker 和 Docker Compose。
- 当前目录为项目根目录。

步骤:

1. 执行 `test -f backend/.dockerignore`。
2. 执行 `grep -q '^node_modules$' backend/.dockerignore`。
3. 执行 `docker compose build --no-cache backend`。

预期结果:

- `backend/.dockerignore` 存在。
- `backend/.dockerignore` 明确排除 `node_modules`。
- backend 镜像构建成功，构建日志显示执行了 `npm install --build-from-source`。

## TC-DOCKER-002 容器启动

前置条件:

- `TC-DOCKER-001` 已通过。

步骤:

1. 执行 `docker compose up -d backend`。
2. 执行 `docker compose ps backend`。

预期结果:

- `wangxt-791-lims-backend` 处于 `running` 状态。
- 主机端口 `17910` 映射到容器端口 `3001`。

## TC-DOCKER-003 数据库健康检查

前置条件:

- backend 容器已启动。

步骤:

1. 执行 `curl -fsS http://localhost:17910/health`。
2. 检查响应 JSON。

预期结果:

- HTTP 请求成功。
- 响应包含 `"status":"healthy"`。
- 响应包含 `"database":"connected"`。

## TC-DOCKER-004 Docker HEALTHCHECK

前置条件:

- backend 容器已启动至少 15 秒。

步骤:

1. 执行 `docker inspect --format '{{.State.Health.Status}}' wangxt-791-lims-backend`。

预期结果:

- 输出为 `healthy`。

## TC-DOCKER-005 容器内 npm test

前置条件:

- backend 容器健康检查通过。

步骤:

1. 执行 `docker compose exec -T backend npm test`。

预期结果:

- 测试进程退出码为 0。
- 输出包含健康检查、业务规则校验和通过汇总。

## TC-DOCKER-006 前端容器联动

前置条件:

- backend 容器健康检查通过。

步骤:

1. 执行 `docker compose up -d frontend`。
2. 执行 `curl -fsS http://localhost:17911/health`。

预期结果:

- `wangxt-791-lims-frontend` 启动成功。
- 前端健康检查请求成功。

## 清理命令

```bash
docker compose down -v
```
