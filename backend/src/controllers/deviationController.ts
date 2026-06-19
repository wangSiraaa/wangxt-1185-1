import { Response } from 'express'
import pool from '../utils/db'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'

export const getDeviationRecords = async (req: AuthRequest, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)

  let query = `
    SELECT d.*, dr.record_time, dr.hour, dr.disinfectant_dosage,
           dr.online_residual_chlorine, u1.name as analyst_name, u2.name as supervisor_name,
           EXISTS (SELECT 1 FROM water_quality_records w WHERE w.dosage_record_id = d.dosage_record_id) as has_quality_record
    FROM deviation_records d
    LEFT JOIN dosage_records dr ON d.dosage_record_id = dr.id
    LEFT JOIN users u1 ON d.analyst_id = u1.id
    LEFT JOIN users u2 ON d.supervisor_id = u2.id
  `
  let countQuery = 'SELECT COUNT(*) FROM deviation_records'
  let params: any[] = []
  let whereClause = ''

  if (status) {
    whereClause = ' WHERE d.status = $1'
    params = [status]
  }

  query += whereClause + ' ORDER BY d.generated_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
  countQuery += whereClause

  const [result, countResult] = await Promise.all([
    pool.query(query, [...params, pageSize, offset]),
    pool.query(countQuery, params)
  ])

  successResponse(res, result.rows, '查询成功', parseInt(countResult.rows[0].count))
}

export const submitAnalystOpinion = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { analyst_opinion, suggested_dosage } = req.body
  const analystId = req.user?.id

  if (!analyst_opinion) {
    return errorResponse(res, '请填写化验员复核意见')
  }

  const deviation = await pool.query(
    'SELECT * FROM deviation_records WHERE id = $1',
    [id]
  )

  if (deviation.rows.length === 0) {
    return errorResponse(res, '偏差记录不存在')
  }

  const hasQualityRecord = await pool.query(
    'SELECT id FROM water_quality_records WHERE dosage_record_id = $1',
    [deviation.rows[0].dosage_record_id]
  )

  if (hasQualityRecord.rows.length === 0) {
    return errorResponse(res, '请先录入化验结果后再提交意见')
  }

  const result = await pool.query(
    `UPDATE deviation_records SET 
      analyst_opinion = $1, suggested_dosage = $2, analyst_id = $3, 
      status = 'analyst_submitted', analyst_submitted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [analyst_opinion, suggested_dosage, analystId, id]
  )

  successResponse(res, result.rows[0], '化验员意见提交成功')
}

export const confirmBySupervisor = async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { supervisor_opinion, need_adjustment } = req.body
  const supervisorId = req.user?.id

  if (!supervisor_opinion) {
    return errorResponse(res, '请填写主管复核意见')
  }

  const deviation = await pool.query(
    'SELECT * FROM deviation_records WHERE id = $1',
    [id]
  )

  if (deviation.rows.length === 0) {
    return errorResponse(res, '偏差记录不存在')
  }

  if (deviation.rows[0].status !== 'analyst_submitted') {
    return errorResponse(res, '只有化验员已提交的偏差才能由主管确认')
  }

  const result = await pool.query(
    `UPDATE deviation_records SET 
      supervisor_opinion = $1, supervisor_id = $2, 
      status = CASE WHEN $3 THEN 'confirmed' ELSE 'closed' END, 
      supervisor_confirmed_at = CURRENT_TIMESTAMP,
      closed_at = CASE WHEN NOT $3 THEN CURRENT_TIMESTAMP ELSE NULL END,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [supervisor_opinion, supervisorId, need_adjustment, id]
  )

  await pool.query(
    `UPDATE dosage_records SET is_locked = TRUE, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [deviation.rows[0].dosage_record_id]
  )

  successResponse(res, result.rows[0], '主管确认成功，原始投加量已锁定')
}

export const closeDeviation = async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const deviation = await pool.query(
    'SELECT * FROM deviation_records WHERE id = $1',
    [id]
  )

  if (deviation.rows.length === 0) {
    return errorResponse(res, '偏差记录不存在')
  }

  const hasQualityRecord = await pool.query(
    'SELECT id FROM water_quality_records WHERE dosage_record_id = $1',
    [deviation.rows[0].dosage_record_id]
  )

  if (hasQualityRecord.rows.length === 0) {
    return errorResponse(res, '化验结果未回传，不能关闭偏差')
  }

  const result = await pool.query(
    `UPDATE deviation_records SET 
      status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id]
  )

  successResponse(res, result.rows[0], '偏差已关闭')
}

export const createManualDeviation = async (req: AuthRequest, res: Response) => {
  const { dosage_record_id, description, suggested_dosage } = req.body
  const userId = req.user?.id

  if (!dosage_record_id || !description) {
    return errorResponse(res, '请填写完整的偏差信息')
  }

  const dosageRecord = await pool.query(
    'SELECT id, disinfectant_dosage, is_locked FROM dosage_records WHERE id = $1',
    [dosage_record_id]
  )

  if (dosageRecord.rows.length === 0) {
    return errorResponse(res, '投加记录不存在')
  }

  if (dosageRecord.rows[0].is_locked) {
    return errorResponse(res, '该投加记录已锁定，无法创建偏差')
  }

  const result = await pool.query(
    `INSERT INTO deviation_records 
     (dosage_record_id, type, description, actual_dosage, suggested_dosage, status, analyst_id)
     VALUES ($1, 'manual', $2, $3, $4, 'analyst_submitted', $5)
     RETURNING *`,
    [dosage_record_id, description, dosageRecord.rows[0].disinfectant_dosage, suggested_dosage, userId]
  )

  successResponse(res, result.rows[0], '人工偏差创建成功')
}
