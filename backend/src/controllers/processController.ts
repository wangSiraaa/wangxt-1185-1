import { Response } from 'express'
import pool from '../utils/db'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'

export const getProcessAdjustments = async (req: AuthRequest, res: Response) => {
  const { page = 1, pageSize = 20 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)

  const query = `
    SELECT pa.*, d.type as deviation_type, d.description as deviation_desc,
           u.name as operator_name
    FROM process_adjustments pa
    LEFT JOIN deviation_records d ON pa.deviation_record_id = d.id
    LEFT JOIN users u ON pa.operator_id = u.id
    ORDER BY pa.effective_time DESC
    LIMIT $1 OFFSET $2
  `
  const countQuery = 'SELECT COUNT(*) FROM process_adjustments'

  const [result, countResult] = await Promise.all([
    pool.query(query, [pageSize, offset]),
    pool.query(countQuery)
  ])

  successResponse(res, result.rows, '查询成功', parseInt(countResult.rows[0].count))
}

export const createProcessAdjustment = async (req: AuthRequest, res: Response) => {
  const { deviation_record_id, adjustment_type, description, before_value, after_value, effective_time } = req.body
  const operatorId = req.user?.id

  if (!adjustment_type || !description || before_value === undefined || !after_value || !effective_time) {
    return errorResponse(res, '请填写完整的工艺调整信息')
  }

  if (deviation_record_id) {
    const deviation = await pool.query(
      'SELECT id, status FROM deviation_records WHERE id = $1',
      [deviation_record_id]
    )
    if (deviation.rows.length === 0) {
      return errorResponse(res, '关联的偏差记录不存在')
    }
    if (deviation.rows[0].status !== 'confirmed') {
      return errorResponse(res, '只能关联已确认的偏差记录')
    }
  }

  const result = await pool.query(
    `INSERT INTO process_adjustments 
     (deviation_record_id, adjustment_type, description, before_value, after_value, effective_time, operator_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [deviation_record_id || null, adjustment_type, description, before_value, after_value, effective_time, operatorId]
  )

  if (deviation_record_id) {
    await pool.query(
      `UPDATE deviation_records SET status = 'closed', closed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [deviation_record_id]
    )
  }

  successResponse(res, result.rows[0], '工艺调整记录创建成功')
}

export const getStatistics = async (req: AuthRequest, res: Response) => {
  const { start_date, end_date } = req.query

  let params: any[] = []

  if (start_date && end_date) {
    params = [start_date, end_date]
  }

  const statsQuery = `
    SELECT 
      COUNT(*) as total_records,
      AVG(flocculant_dosage) as avg_flocculant,
      AVG(disinfectant_dosage) as avg_disinfectant,
      AVG(online_residual_chlorine) as avg_chlorine,
      SUM(CASE WHEN is_locked THEN 1 ELSE 0 END) as locked_count
    FROM dosage_records
    ${params.length > 0 ? 'WHERE record_time BETWEEN $1 AND $2' : ''}
  `

  const deviationStatsQuery = `
    SELECT 
      COUNT(*) as total_deviations,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'analyst_submitted' THEN 1 ELSE 0 END) as analyst_submitted_count,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count
    FROM deviation_records d
    LEFT JOIN dosage_records dr ON d.dosage_record_id = dr.id
    ${params.length > 0 ? 'WHERE dr.record_time BETWEEN $1 AND $2' : ''}
  `

  const [statsResult, deviationResult] = await Promise.all([
    pool.query(statsQuery, params),
    pool.query(deviationStatsQuery, params)
  ])

  successResponse(res, {
    dosage: statsResult.rows[0],
    deviation: deviationResult.rows[0]
  })
}
