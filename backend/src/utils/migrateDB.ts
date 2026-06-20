import pool from './db'

const migrationSQL = `
-- 迁移脚本 v1 -> v2: 偏差闭环管理升级

-- 1. 新增偏差类型: high_turbidity
ALTER TABLE deviation_records 
DROP CONSTRAINT IF EXISTS deviation_records_type_check;

ALTER TABLE deviation_records 
ADD CONSTRAINT deviation_records_type_check 
CHECK (type IN ('low_chlorine', 'high_turbidity', 'manual'));

-- 2. 新增 deviation_metric 字段
ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS deviation_metric VARCHAR(20) NOT NULL DEFAULT 'residual_chlorine'
CHECK (deviation_metric IN ('residual_chlorine', 'turbidity', 'manual'));

-- 3. 新增 actual_value 和 threshold_value 字段
ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS actual_value DECIMAL(10,3);

ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS threshold_value DECIMAL(10,3);

-- 4. 新增连续偏离小时数
ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS consecutive_hours INTEGER DEFAULT 1;

-- 5. 新增影响时段
ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS affect_start_time TIMESTAMP;

ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS affect_end_time TIMESTAMP;

-- 6. 新增复发关联
ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS parent_deviation_id INTEGER REFERENCES deviation_records(id);

ALTER TABLE deviation_records 
ADD COLUMN IF NOT EXISTS is_recurrence BOOLEAN DEFAULT FALSE;

-- 7. 更新现有记录的 deviation_metric
UPDATE deviation_records SET deviation_metric = 'residual_chlorine' WHERE type = 'low_chlorine';
UPDATE deviation_records SET deviation_metric = 'manual' WHERE type = 'manual';

-- 8. 更新现有记录的 affect_start_time 和 affect_end_time
UPDATE deviation_records d
SET affect_start_time = dr.record_time + (dr.hour || ' hours')::INTERVAL,
    affect_end_time = dr.record_time + ((dr.hour + 1) || ' hours')::INTERVAL
FROM dosage_records dr
WHERE d.dosage_record_id = dr.id AND d.affect_start_time IS NULL;

-- 9. 新增索引
CREATE INDEX IF NOT EXISTS idx_deviation_metric ON deviation_records(deviation_metric);
CREATE INDEX IF NOT EXISTS idx_deviation_parent ON deviation_records(parent_deviation_id);
CREATE INDEX IF NOT EXISTS idx_deviation_affect_start ON deviation_records(affect_start_time);

-- 10. 新增系统配置项
INSERT INTO system_config (config_key, config_value, description) VALUES
('consecutive_deviation_hours', '3', '连续偏离检测小时数'),
('recurrence_lookback_days', '7', '异常复发回溯天数'),
('adjustment_compare_hours', '24', '工艺调整前后对比小时数')
ON CONFLICT (config_key) DO NOTHING;
`

export const migrateDB = async () => {
  try {
    console.log('开始数据库迁移...')
    await pool.query(migrationSQL)
    console.log('数据库迁移完成!')
    console.log('新增字段: deviation_metric, actual_value, threshold_value, consecutive_hours, affect_start_time, affect_end_time, parent_deviation_id, is_recurrence')
    console.log('新增配置: consecutive_deviation_hours, recurrence_lookback_days, adjustment_compare_hours')
    process.exit(0)
  } catch (error) {
    console.error('数据库迁移失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  migrateDB()
}

export default migrateDB
