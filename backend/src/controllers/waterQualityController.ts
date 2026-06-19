import { Response } from 'express'
import pool from '../utils/db'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'

export const getWaterQualityRecords = async (req: AuthRequest, res: Response) => {
  const { date, page = 1, pageSize = 24 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)

  let query = `
    SELECT wqr.*, dr.record_time, dr.hour, u.name as analyst_name
    FROM water_quality_records wqr
    LEFT JOIN dosage_records dr ON wqr.dosage_record_id = dr.id
    LEFT JOIN users u ON wqr.analyst_id = u.id
  `
  let countQuery = 'SELECT COUNT(*) FROM water_quality_records wqr LEFT JOIN dosage_records dr ON wqr.dosage_record_id = dr.id'
  let params: any[] = []
  let whereClause = ''

  if (date) {
    whereClause = ' WHERE dr.record_time = $1'
    params = [date]
  }

  query += whereClause + ' ORDER BY dr.record_time DESC, dr.hour DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
  countQuery += whereClause

  const [result, countResult] = await Promise.all([
    pool.query(query, [...params, pageSize, offset]),
    pool.query(countQuery, params)
  ])

  successResponse(res, result.rows, '查询成功', parseInt(countResult.rows[0].count))
}

export const createWaterQualityRecord = async (req: AuthRequest, res: Response) => {
  const { dosage_record_id, turbidity, ph, residual_chlorine, coli_group, total_bacteria } = req.body
  const analystId = req.user?.id

  if (!dosage_record_id || turbidity === undefined || !ph || residual_chlorine === undefined || !coli_group || !total_bacteria) {
    return errorResponse(res, '请填写完整的水质化验信息')
  }

  const dosageRecord = await pool.query(
    'SELECT id, is_locked FROM dosage_records WHERE id = $1',
    [dosage_record_id]
  )

  if (dosageRecord.rows.length === 0) {
    return errorResponse(res, '对应的投加记录不存在')
  }

  const existing = await pool.query(
    'SELECT id FROM water_quality_records WHERE dosage_record_id = $1',
    [dosage_record_id]
  )

  let result
  if (existing.rows.length > 0) {
    result = await pool.query(
      `UPDATE water_quality_records SET 
        turbidity = $1, ph = $2, residual_chlorine = $3, coli_group = $4, total_bacteria = $5,
        analyst_id = $6, updated_at = CURRENT_TIMESTAMP
       WHERE dosage_record_id = $7
       RETURNING *`,
      [turbidity, ph, residual_chlorine, coli_group, total_bacteria, analystId, dosage_record_id]
    )
  } else {
    result = await pool.query(
      `INSERT INTO water_quality_records 
       (dosage_record_id, turbidity, ph, residual_chlorine, coli_group, total_bacteria, analyst_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [dosage_record_id, turbidity, ph, residual_chlorine, coli_group, total_bacteria, analystId]
    )
  }

  const pendingDeviations = await pool.query(
    `SELECT id FROM deviation_records 
     WHERE dosage_record_id = $1 AND status = 'pending'`,
    [dosage_record_id]
  )

  for (const dev of pendingDeviations.rows) {
    await pool.query(
      `UPDATE deviation_records SET status = 'analyst_submitted' WHERE id = $1`,
      [dev.id]
    )
  }

  successResponse(res, result.rows[0], '化验记录保存成功')
}

export const getPendingForAnalyst = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    `SELECT dr.*, 
            EXISTS (SELECT 1 FROM deviation_records d WHERE d.dosage_record_id = dr.id) as has_deviation
     FROM dosage_records dr
     WHERE NOT EXISTS (
       SELECT 1 FROM water_quality_records wqr 
       WHERE wqr.dosage_record_id = dr.id
     )
     ORDER BY dr.record_time DESC, dr.hour DESC
     LIMIT 50`
  )
  successResponse(res, result.rows)
}
