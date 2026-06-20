import pool from './db'
import bcrypt from 'bcryptjs'

const initSQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('controller', 'analyst', 'supervisor')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 药剂投加记录表
CREATE TABLE IF NOT EXISTS dosage_records (
  id SERIAL PRIMARY KEY,
  record_time DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  flocculant_dosage DECIMAL(10,2) NOT NULL,
  disinfectant_dosage DECIMAL(10,2) NOT NULL,
  online_residual_chlorine DECIMAL(10,3) NOT NULL,
  controller_id INTEGER REFERENCES users(id),
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_time, hour)
);

-- 水质化验记录表
CREATE TABLE IF NOT EXISTS water_quality_records (
  id SERIAL PRIMARY KEY,
  dosage_record_id INTEGER REFERENCES dosage_records(id),
  turbidity DECIMAL(10,3) NOT NULL,
  ph DECIMAL(10,2) NOT NULL,
  residual_chlorine DECIMAL(10,3) NOT NULL,
  coli_group VARCHAR(20) NOT NULL,
  total_bacteria VARCHAR(20) NOT NULL,
  analyst_id INTEGER REFERENCES users(id),
  record_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 偏差记录表
CREATE TABLE IF NOT EXISTS deviation_records (
  id SERIAL PRIMARY KEY,
  dosage_record_id INTEGER REFERENCES dosage_records(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('low_chlorine', 'high_turbidity', 'manual')),
  deviation_metric VARCHAR(20) NOT NULL DEFAULT 'residual_chlorine' 
    CHECK (deviation_metric IN ('residual_chlorine', 'turbidity', 'manual')),
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'analyst_submitted', 'confirmed', 'closed')),
  actual_dosage DECIMAL(10,2) NOT NULL,
  suggested_dosage DECIMAL(10,2),
  actual_value DECIMAL(10,3),
  threshold_value DECIMAL(10,3),
  consecutive_hours INTEGER DEFAULT 1,
  affect_start_time TIMESTAMP,
  affect_end_time TIMESTAMP,
  parent_deviation_id INTEGER REFERENCES deviation_records(id),
  is_recurrence BOOLEAN DEFAULT FALSE,
  analyst_opinion TEXT,
  supervisor_opinion TEXT,
  analyst_id INTEGER REFERENCES users(id),
  supervisor_id INTEGER REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyst_submitted_at TIMESTAMP,
  supervisor_confirmed_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 工艺调整记录表
CREATE TABLE IF NOT EXISTS process_adjustments (
  id SERIAL PRIMARY KEY,
  deviation_record_id INTEGER REFERENCES deviation_records(id),
  adjustment_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  before_value DECIMAL(10,2) NOT NULL,
  after_value DECIMAL(10,2) NOT NULL,
  effective_time TIMESTAMP NOT NULL,
  operator_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_dosage_record_time ON dosage_records(record_time);
CREATE INDEX IF NOT EXISTS idx_dosage_hour ON dosage_records(hour);
CREATE INDEX IF NOT EXISTS idx_deviation_status ON deviation_records(status);
CREATE INDEX IF NOT EXISTS idx_deviation_dosage_id ON deviation_records(dosage_record_id);
CREATE INDEX IF NOT EXISTS idx_deviation_metric ON deviation_records(deviation_metric);
CREATE INDEX IF NOT EXISTS idx_deviation_parent ON deviation_records(parent_deviation_id);
CREATE INDEX IF NOT EXISTS idx_deviation_affect_start ON deviation_records(affect_start_time);
CREATE INDEX IF NOT EXISTS idx_water_quality_dosage_id ON water_quality_records(dosage_record_id);
CREATE INDEX IF NOT EXISTS idx_process_adjustment_time ON process_adjustments(effective_time);
`

const insertDefaultData = async () => {
  const hashedPassword = await bcrypt.hash('123456', 10)
  
  const usersSQL = `
    INSERT INTO users (username, name, role, password_hash) VALUES
    ('controller1', '张中控', 'controller', $1),
    ('analyst1', '李化验', 'analyst', $1),
    ('supervisor1', '王主管', 'supervisor', $1)
    ON CONFLICT (username) DO NOTHING;
  `
  
  const configSQL = `
    INSERT INTO system_config (config_key, config_value, description) VALUES
    ('residual_chlorine_min', '0.3', '出厂水余氯下限(mg/L)'),
    ('residual_chlorine_max', '0.5', '出厂水余氯上限(mg/L)'),
    ('flocculant_standard', '10.0', '絮凝剂标准投加量(mg/L)'),
    ('disinfectant_standard', '2.0', '消毒剂标准投加量(mg/L)'),
    ('turbidity_max', '1.0', '浊度上限(NTU)'),
    ('ph_min', '6.5', 'pH下限'),
    ('ph_max', '8.5', 'pH上限'),
    ('consecutive_deviation_hours', '3', '连续偏离检测小时数'),
    ('recurrence_lookback_days', '7', '异常复发回溯天数'),
    ('adjustment_compare_hours', '24', '工艺调整前后对比小时数')
    ON CONFLICT (config_key) DO NOTHING;
  `

  await pool.query(usersSQL, [hashedPassword])
  await pool.query(configSQL)
}

export const initDB = async () => {
  try {
    console.log('开始初始化数据库...')
    await pool.query(initSQL)
    console.log('表结构创建完成')
    await insertDefaultData()
    console.log('默认数据插入完成')
    console.log('数据库初始化成功!')
    console.log('默认账号: controller1/analyst1/supervisor1, 密码: 123456')
    process.exit(0)
  } catch (error) {
    console.error('数据库初始化失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  initDB()
}

export default initDB
