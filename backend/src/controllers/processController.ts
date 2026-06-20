import { Response } from 'express'
import pool from '../utils/db'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'
import { getAdjustmentCompareHours } from '../utils/config'

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

export const getAdjustmentCompare = async (req: AuthRequest, res: Response) => {
  const { adjustment_id } = req.params

  const adjustment = await pool.query(
    'SELECT * FROM process_adjustments WHERE id = $1',
    [adjustment_id]
  )

  if (adjustment.rows.length === 0) {
    return errorResponse(res, '工艺调整记录不存在')
  }

  const effectiveTime = adjustment.rows[0].effective_time
  const compareHours = await getAdjustmentCompareHours()

  const beforeQuery = `
    SELECT dr.id, dr.record_time, dr.hour, dr.flocculant_dosage, dr.disinfectant_dosage,
           dr.online_residual_chlorine, wqr.turbidity, wqr.residual_chlorine as lab_residual_chlorine
    FROM dosage_records dr
    LEFT JOIN water_quality_records wqr ON wqr.dosage_record_id = dr.id
    WHERE dr.record_time + (dr.hour || ' hours')::INTERVAL < $1
      AND dr.record_time + (dr.hour || ' hours')::INTERVAL >= $1 - ($2 || ' hours')::INTERVAL
    ORDER BY dr.record_time ASC, dr.hour ASC
  `

  const afterQuery = `
    SELECT dr.id, dr.record_time, dr.hour, dr.flocculant_dosage, dr.disinfectant_dosage,
           dr.online_residual_chlorine, wqr.turbidity, wqr.residual_chlorine as lab_residual_chlorine
    FROM dosage_records dr
    LEFT JOIN water_quality_records wqr ON wqr.dosage_record_id = dr.id
    WHERE dr.record_time + (dr.hour || ' hours')::INTERVAL >= $1
      AND dr.record_time + (dr.hour || ' hours')::INTERVAL < $1 + ($2 || ' hours')::INTERVAL
    ORDER BY dr.record_time ASC, dr.hour ASC
  `

  const [beforeResult, afterResult] = await Promise.all([
    pool.query(beforeQuery, [effectiveTime, compareHours]),
    pool.query(afterQuery, [effectiveTime, compareHours])
  ])

  const beforeData = beforeResult.rows.map((row: any) => ({
  ...row,
  time_label: `${row.record_time} ${row.hour.toString().padStart(2, '0')}:00`
}))
  const afterData = afterResult.rows.map((row: any) => ({
  ...row,
  time_label: `${row.record_time} ${row.hour.toString().padStart(2, '0')}:00`
}))

  const beforeAvg = calculateAverages(beforeResult.rows)
  const afterAvg = calculateAverages(afterResult.rows)

  successResponse(res, {
    adjustment: adjustment.rows[0],
    compare_hours: compareHours,
    before: beforeData,
    after: afterData,
    before_average: beforeAvg,
    after_average: afterAvg,
    comparison: {
      flocculant_change: afterAvg.flocculant - beforeAvg.flocculant,
      disinfectant_change: afterAvg.disinfectant - beforeAvg.disinfectant,
      residual_chlorine_change: afterAvg.online_residual_chlorine - beforeAvg.online_residual_chlorine,
      turbidity_change: afterAvg.turbidity - beforeAvg.turbidity
    }
  })
}

const calculateAverages = (rows: any[]) => {
  if (rows.length === 0) {
    return {
      flocculant: 0,
      disinfectant: 0,
      online_residual_chlorine: 0,
      turbidity: 0
    }
  }

  let flocculantSum = 0
  let disinfectantSum = 0
  let chlorineSum = 0
  let turbiditySum = 0
  let turbidityCount = 0

  for (const row of rows) {
    flocculantSum += parseFloat(row.flocculant_dosage || 0)
    disinfectantSum += parseFloat(row.disinfectant_dosage || 0)
    chlorineSum += parseFloat(row.online_residual_chlorine || 0)
    if (row.turbidity !== null && row.turbidity !== undefined) {
      turbiditySum += parseFloat(row.turbidity)
      turbidityCount++
    }
  }

  return {
    flocculant: flocculantSum / rows.length,
    disinfectant: disinfectantSum / rows.length,
    online_residual_chlorine: chlorineSum / rows.length,
    turbidity: turbidityCount > 0 ? turbiditySum / turbidityCount : 0
  }
}
