import { Response } from 'express'
import pool from '../utils/db'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'
import { getAllConfigs, updateConfig } from '../utils/config'

export const getSystemConfigs = async (req: AuthRequest, res: Response) => {
  const configs = await getAllConfigs()
  successResponse(res, configs)
}

export const updateSystemConfig = async (req: AuthRequest, res: Response) => {
  const { config_key, config_value } = req.body

  if (!config_key || config_value === undefined) {
    return errorResponse(res, '配置键和值不能为空')
  }

  await updateConfig(config_key, config_value)
  successResponse(res, null, '配置更新成功')
}

export const batchUpdateConfigs = async (req: AuthRequest, res: Response) => {
  const { configs } = req.body

  if (!Array.isArray(configs)) {
    return errorResponse(res, '配置数据格式错误')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const config of configs) {
      await client.query(
        'UPDATE system_config SET config_value = $1, updated_at = CURRENT_TIMESTAMP WHERE config_key = $2',
        [config.config_value, config.config_key]
      )
    }
    await client.query('COMMIT')
    successResponse(res, null, '批量更新成功')
  } catch (error) {
    await client.query('ROLLBACK')
    errorResponse(res, '批量更新失败')
  } finally {
    client.release()
  }
}
