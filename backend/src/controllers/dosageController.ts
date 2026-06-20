import { Response } from 'express'
import pool from '../utils/db'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'
import { getMinResidualChlorine } from '../utils/config'
import {
  checkConsecutiveDeviation,
  createDeviationFromConsecutive,
  hasActiveDeviation
} from '../utils/deviationDetector'
import { DeviationMetric } from '../types'
import dayjs from 'dayjs'

export const getDosageRecords = async (req: AuthRequest, res: Response) => {
  const { date, page = 1, pageSize = 24 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)

  let query = `
    SELECT dr.*, u.name as controller_name,
           wqr.id as has_quality_record,
           EXISTS (SELECT 1 FROM deviation_records d WHERE d.dosage_record_id = dr.id) as has_deviation
    FROM dosage_records dr
    LEFT JOIN users u ON dr.controller_id = u.id
    LEFT JOIN water_quality_records wqr ON wqr.dosage_record_id = dr.id
  `
  let countQuery = 'SELECT COUNT(*) FROM dosage_records'
  let params: any[] = []
  let whereClause = ''

  if (date) {
    whereClause = ' WHERE record_time = $1'
    params = [date]
  }

  query += whereClause.replace('WHERE record_time', 'WHERE dr.record_time') + ' ORDER BY dr.record_time DESC, dr.hour DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
  countQuery += whereClause

  const [result, countResult] = await Promise.all([
    pool.query(query, [...params, pageSize, offset]),
    pool.query(countQuery, params)
  ])

  successResponse(res, result.rows, '查询成功', parseInt(countResult.rows[0].count))
}

export const createDosageRecord = async (req: AuthRequest, res: Response) => {
  const { record_time, hour, flocculant_dosage, disinfectant_dosage, online_residual_chlorine } = req.body
  const controllerId = req.user?.id

  if (!record_time || hour === undefined || !flocculant_dosage || !disinfectant_dosage || online_residual_chlorine === undefined) {
    return errorResponse(res, '请填写完整的投加记录信息')
  }

  const existing = await pool.query(
    'SELECT id, is_locked FROM dosage_records WHERE record_time = $1 AND hour = $2',
    [record_time, hour]
  )

  if (existing.rows.length > 0) {
    if (existing.rows[0].is_locked) {
      return errorResponse(res, '该时段记录已被主管确认，无法修改')
    }
    const result = await pool.query(
      `UPDATE dosage_records SET 
        flocculant_dosage = $1, disinfectant_dosage = $2, online_residual_chlorine = $3,
        controller_id = $4, updated_at = CURRENT_TIMESTAMP
       WHERE record_time = $5 AND hour = $6
       RETURNING *`,
      [flocculant_dosage, disinfectant_dosage, online_residual_chlorine, controllerId, record_time, hour]
    )
    await checkAndCreateDeviation(result.rows[0].id, online_residual_chlorine)
    return successResponse(res, result.rows[0], '记录更新成功')
  }

  const result = await pool.query(
    `INSERT INTO dosage_records 
     (record_time, hour, flocculant_dosage, disinfectant_dosage, online_residual_chlorine, controller_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [record_time, hour, flocculant_dosage, disinfectant_dosage, online_residual_chlorine, controllerId]
  )

  await checkAndCreateDeviation(result.rows[0].id, online_residual_chlorine)
  successResponse(res, result.rows[0], '记录创建成功')
}

const checkAndCreateDeviation = async (dosageRecordId: number, onlineResidualChlorine: number) => {
  const result = await checkConsecutiveDeviation(dosageRecordId, 'residual_chlorine')

  if (result.isConsecutive && result.startRecordId && result.startTime && result.endTime) {
    await createDeviationFromConsecutive(
      result.startRecordId,
      'residual_chlorine',
      result.consecutiveCount,
      result.startTime,
      result.endTime,
      onlineResidualChlorine
    )
  }
}

export const getDosageRecordById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const result = await pool.query(
    `SELECT dr.*, u.name as controller_name 
     FROM dosage_records dr 
     LEFT JOIN users u ON dr.controller_id = u.id 
     WHERE dr.id = $1`,
    [id]
  )
  if (result.rows.length === 0) {
    return errorResponse(res, '记录不存在')
  }
  successResponse(res, result.rows[0])
}
