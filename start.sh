#!/bin/bash

echo "========================================"
echo "  LIMS 样品委托系统 - 启动脚本"
echo "========================================"

echo ""
echo "[1] 启动后端服务..."
cd backend

if [ ! -d "node_modules" ]; then
  echo "  安装后端依赖..."
  npm install
fi

echo "  启动后端服务 (端口 3001)..."
node src/server.js &
BACKEND_PID=$!

echo ""
echo "[2] 等待后端服务就绪..."
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "  后端服务已就绪!"
    break
  fi
  sleep 1
  echo -n "."
done

echo ""
echo "[3] 执行健康检查..."
curl -s http://localhost:3001/health
echo ""

echo ""
echo "[4] 执行验收测试..."
cd tests
node acceptance.js
TEST_RESULT=$?
cd ../..

echo ""
echo "[5] 后端服务已启动，PID: $BACKEND_PID"
echo "    API 地址: http://localhost:3001"
echo "    健康检查: http://localhost:3001/health"
echo ""
echo "    如需停止服务，请执行: kill $BACKEND_PID"
echo ""

if [ $TEST_RESULT -ne 0 ]; then
  echo "⚠️  验收测试存在失败项，请检查输出"
else
  echo "✅  验收测试全部通过!"
fi

echo ""
echo "========================================"
