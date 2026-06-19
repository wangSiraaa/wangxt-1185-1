#自来水厂药剂投加偏差复核系统

## 项目概述

本系统为自来水厂提供药剂投加偏差复核管理，服务于中控员、化验员和工艺主管三种角色，实现投加记录、水质化验、偏差管理和工艺调整的全流程闭环管理。

## 核心功能

### 角色与权限

| 角色 | 权限 |
|------|------|
| 中控员 | 录入絮凝剂和消毒剂投加量、查看投加记录 |
| 化验员 | 录入出厂水指标、提交偏差复核意见 |
| 工艺主管 | 全部功能、偏差确认、工艺调整、系统配置 |

### 业务流程

1. **投加记录**：中控员每小时录入絮凝剂、消毒剂投加量及在线余氯值
2. **自动偏差**：在线余氯低于下限(0.3mg/L)时，系统自动生成偏差记录
3. **化验录入**：化验员录入出厂水水质指标（浊度、pH、余氯、大肠菌群、细菌总数）
4. **化验复核**：化验员提交偏差处理意见
5. **主管确认**：主管复核，确认后原始投加量锁定不可修改
6. **工艺调整**：主管可发起工艺调整记录

### 业务规则

- ✅ 在线余氯低于下限自动生成偏差
- ✅ 化验结果未回传不能关闭偏差
- ✅ 主管确认后不能修改原始投加量
- ✅ 每小时数据独立存储，支持历史追溯

## 技术栈

### 后端
- Node.js + Express + TypeScript
- PostgreSQL 数据库
- JWT 身份认证
- bcrypt 密码加密

### 前端
- Vue 3 + TypeScript
- Element Plus UI 组件库
- Pinia 状态管理
- Vue Router 路由
- ECharts 图表库
- Axios HTTP 请求

### 部署
- Docker + Docker Compose
- Nginx 前端代理

## 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 初始化数据库（首次启动需要）
docker exec -it water_plant_backend sh -c "cd /app && node -r ts-node/register src/utils/initDB.ts"

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 停止服务
docker-compose down
```

### 方式二：本地开发

```bash
# 1. 启动数据库
docker run -d --name water_plant_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=water_plant \
  -p 21485:5432 \
  postgres:15-alpine

# 2. 初始化数据库
cd backend
npm install
npm run init-db

# 3. 启动后端
npm run dev

# 4. 启动前端（新终端）
cd ../frontend
npm install
npm run dev
```

## 冒烟测试

```bash
bash scripts/smoke.sh
```

## 访问地址

- 前端: http://localhost:20485
- 后端API: http://localhost:19485/api
- 数据库: localhost:21485

## 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| controller1 | 123456 | 中控员 |
| analyst1 | 123456 | 化验员 |
| supervisor1 | 123456 | 工艺主管 |

## 项目结构

```
.
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── controllers/        # 控制器
│   │   ├── middleware/         # 中间件
│   │   ├── routes/             # 路由
│   │   ├── types/              # 类型定义
│   │   ├── utils/              # 工具函数
│   │   └── index.ts            # 入口文件
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── api/                # API 接口
│   │   ├── components/         # 公共组件
│   │   ├── router/             # 路由配置
│   │   ├── store/              # 状态管理
│   │   ├── types/              # 类型定义
│   │   ├── views/              # 页面组件
│   │   ├── App.vue
│   │   └── main.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── scripts/                    # 脚本文件
│   └── smoke.sh               # 冒烟测试
├── docker-compose.yml          # Docker 编排
└── README.md
```

## 数据库表结构

| 表名 | 说明 |
|------|------|
| users | 用户表 |
| dosage_records | 药剂投加记录表 |
| water_quality_records | 水质化验记录表 |
| deviation_records | 偏差记录表 |
| process_adjustments | 工艺调整记录表 |
| system_config | 系统配置表 |

## API 接口

### 认证接口
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/change-password` - 修改密码

### 投加记录
- `GET /api/dosage` - 查询投加记录
- `POST /api/dosage` - 创建/更新投加记录
- `GET /api/dosage/:id` - 获取投加记录详情

### 水质指标
- `GET /api/water-quality` - 查询水质记录
- `POST /api/water-quality` - 创建水质记录
- `GET /api/water-quality/pending` - 获取待化验列表

### 偏差管理
- `GET /api/deviation` - 查询偏差记录
- `POST /api/deviation/manual` - 人工创建偏差
- `PUT /api/deviation/:id/analyst` - 化验员提交意见
- `PUT /api/deviation/:id/confirm` - 主管确认
- `PUT /api/deviation/:id/close` - 关闭偏差

### 工艺调整
- `GET /api/process-adjustment` - 查询调整记录
- `POST /api/process-adjustment` - 创建调整记录
- `GET /api/statistics` - 获取统计数据

### 系统配置
- `GET /api/config` - 获取配置
- `PUT /api/config` - 更新配置
- `PUT /api/config/batch` - 批量更新配置
