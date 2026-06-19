import pool from './db'
import { SystemConfig } from '../types'

export const getConfigValue = async (key: string): Promise<string | null> => {
  const result = await pool.query(
    'SELECT config_value FROM system_config WHERE config_key = $1',
    [key]
  )
  return result.rows[0]?.config_value || null
}

export const getMinResidualChlorine = async (): Promise<number> => {
  const value = await getConfigValue('residual_chlorine_min')
  return parseFloat(value || '0.3')
}

export const getAllConfigs = async (): Promise<SystemConfig[]> => {
  const result = await pool.query('SELECT * FROM system_config ORDER BY id')
  return result.rows
}

export const updateConfig = async (key: string, value: string): Promise<void> => {
  await pool.query(
    'UPDATE system_config SET config_value = $1, updated_at = CURRENT_TIMESTAMP WHERE config_key = $2',
    [value, key]
  )
}
