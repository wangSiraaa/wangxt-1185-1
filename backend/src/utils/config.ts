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

export const getMaxResidualChlorine = async (): Promise<number> => {
  const value = await getConfigValue('residual_chlorine_max')
  return parseFloat(value || '0.5')
}

export const getMaxTurbidity = async (): Promise<number> => {
  const value = await getConfigValue('turbidity_max')
  return parseFloat(value || '1.0')
}

export const getConsecutiveDeviationHours = async (): Promise<number> => {
  const value = await getConfigValue('consecutive_deviation_hours')
  return parseInt(value || '3')
}

export const getRecurrenceLookbackDays = async (): Promise<number> => {
  const value = await getConfigValue('recurrence_lookback_days')
  return parseInt(value || '7')
}

export const getAdjustmentCompareHours = async (): Promise<number> => {
  const value = await getConfigValue('adjustment_compare_hours')
  return parseInt(value || '24')
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
