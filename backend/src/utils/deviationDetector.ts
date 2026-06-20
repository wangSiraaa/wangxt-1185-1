import pool from './db'
import {
  getMinResidualChlorine,
  getConsecutiveDeviationHours,
  getRecurrenceLookbackDays,
  getMaxTurbidity
} from './config'
import { DeviationMetric } from '../types'
import dayjs from 'dayjs'

interface ConsecutiveCheckResult {
  isConsecutive: boolean
  consecutiveCount: number
  startRecordId: number | null
  startTime: Date | null
  endTime: Date | null
  records: Array<{
    id: number
    record_time: Date
    hour: number
    online_residual_chlorine: number
    turbidity?: number
  }>
}

export const checkConsecutiveDeviation = async (
  dosageRecordId: number,
  metric: DeviationMetric
): Promise<ConsecutiveCheckResult> => {
  const currentRecord = await pool.query(
    'SELECT id, record_time, hour, online_residual_chlorine FROM dosage_records WHERE id = $1',
    [dosageRecordId]
  )

  if (currentRecord.rows.length === 0) {
    return {
      isConsecutive: false,
      consecutiveCount: 0,
      startRecordId: null,
      startTime: null,
      endTime: null,
      records: []
    }
  }

  const current = currentRecord.rows[0]
  const currentDateTime = dayjs(current.record_time).add(current.hour, 'hour')

  const consecutiveHours = await getConsecutiveDeviationHours()
  const threshold = metric === 'residual_chlorine' 
    ? await getMinResidualChlorine() 
    : await getMaxTurbidity()

  const lookbackHours = consecutiveHours * 2

  const query = metric === 'residual_chlorine'
    ? `
      SELECT id, record_time, hour, online_residual_chlorine
      FROM dosage_records
      WHERE record_time + (hour || ' hours')::INTERVAL <= $1
        AND record_time + (hour || ' hours')::INTERVAL >= $1 - ($2 || ' hours')::INTERVAL
        AND online_residual_chlorine < $3
      ORDER BY record_time DESC, hour DESC
    `
    : `
      SELECT dr.id, dr.record_time, dr.hour, dr.online_residual_chlorine, wqr.turbidity
      FROM dosage_records dr
      LEFT JOIN water_quality_records wqr ON wqr.dosage_record_id = dr.id
      WHERE dr.record_time + (dr.hour || ' hours')::INTERVAL <= $1
        AND dr.record_time + (dr.hour || ' hours')::INTERVAL >= $1 - ($2 || ' hours')::INTERVAL
        AND wqr.turbidity IS NOT NULL AND wqr.turbidity > $3
      ORDER BY dr.record_time DESC, dr.hour DESC
    `

  const result = await pool.query(query, [
    currentDateTime.toDate(),
    lookbackHours,
    threshold
  ])

  if (result.rows.length === 0) {
    return {
      isConsecutive: false,
      consecutiveCount: 0,
      startRecordId: null,
      startTime: null,
      endTime: null,
      records: []
    }
  }

  const sortedRecords = result.rows.sort((a: any, b: any) => {
    const aTime = dayjs(a.record_time).add(a.hour, 'hour')
    const bTime = dayjs(b.record_time).add(b.hour, 'hour')
    return aTime.valueOf() - bTime.valueOf()
  })

  let consecutiveCount = 0
  let startIdx = 0

  for (let i = sortedRecords.length - 1; i >= 0; i--) {
    const recordTime = dayjs(sortedRecords[i].record_time).add(sortedRecords[i].hour, 'hour')
    const nextTime = i < sortedRecords.length - 1
      ? dayjs(sortedRecords[i + 1].record_time).add(sortedRecords[i + 1].hour, 'hour')
      : currentDateTime

    const diffHours = nextTime.diff(recordTime, 'hour')

    if (diffHours <= 1) {
      consecutiveCount++
    } else {
      break
    }
    startIdx = i
  }

  const isCurrentIncluded = sortedRecords.some((r: any) => r.id === dosageRecordId)
  if (!isCurrentIncluded) {
    return {
      isConsecutive: false,
      consecutiveCount: 0,
      startRecordId: null,
      startTime: null,
      endTime: null,
      records: []
    }
  }

  const consecutiveRecords = sortedRecords.slice(startIdx)
  const isConsecutive = consecutiveRecords.length >= consecutiveHours

  const startTime = dayjs(consecutiveRecords[0].record_time)
    .add(consecutiveRecords[0].hour, 'hour')
    .toDate()
  const endTime = dayjs(consecutiveRecords[consecutiveRecords.length - 1].record_time)
    .add(consecutiveRecords[consecutiveRecords.length - 1].hour + 1, 'hour')
    .toDate()

  return {
    isConsecutive,
    consecutiveCount: consecutiveRecords.length,
    startRecordId: consecutiveRecords[0].id,
    startTime,
    endTime,
    records: consecutiveRecords
  }
}

export const findRecurrenceDeviation = async (
  metric: DeviationMetric,
  currentTime: Date
): Promise<number | null> => {
  const lookbackDays = await getRecurrenceLookbackDays()
  const startTime = dayjs(currentTime).subtract(lookbackDays, 'day').toDate()

  const result = await pool.query(
    `
    SELECT id, generated_at, status
    FROM deviation_records
    WHERE deviation_metric = $1
      AND generated_at BETWEEN $2 AND $3
      AND status = 'closed'
      AND is_recurrence = false
    ORDER BY generated_at DESC
    LIMIT 1
    `,
    [metric, startTime, currentTime]
  )

  return result.rows.length > 0 ? result.rows[0].id : null
}

export const hasActiveDeviation = async (
  dosageRecordId: number,
  metric: DeviationMetric
): Promise<boolean> => {
  const type = metric === 'residual_chlorine' ? 'low_chlorine' : 'high_turbidity'
  
  const result = await pool.query(
    `
    SELECT id FROM deviation_records 
    WHERE dosage_record_id = $1 AND type = $2 AND status != 'closed'
    `,
    [dosageRecordId, type]
  )

  return result.rows.length > 0
}

export const createDeviationFromConsecutive = async (
  startDosageRecordId: number,
  metric: DeviationMetric,
  consecutiveCount: number,
  affectStartTime: Date,
  affectEndTime: Date,
  actualValue: number
): Promise<number | null> => {
  const threshold = metric === 'residual_chlorine'
    ? await getMinResidualChlorine()
    : await getMaxTurbidity()

  const type = metric === 'residual_chlorine' ? 'low_chlorine' : 'high_turbidity'

  const existingActiveDeviation = await pool.query(
    `
    SELECT id FROM deviation_records
    WHERE deviation_metric = $1
      AND status != 'closed'
      AND affect_start_time <= $2
      AND affect_end_time >= $2
    LIMIT 1
    `,
    [metric, affectStartTime]
  )

  if (existingActiveDeviation.rows.length > 0) {
    const existingId = existingActiveDeviation.rows[0].id
    await pool.query(
      `
      UPDATE deviation_records
      SET affect_end_time = $1,
          consecutive_hours = GREATEST(consecutive_hours, $2),
          actual_value = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [affectEndTime, consecutiveCount, actualValue, existingId]
    )
    return existingId
  }

  const dosageRecord = await pool.query(
    'SELECT disinfectant_dosage, flocculant_dosage FROM dosage_records WHERE id = $1',
    [startDosageRecordId]
  )

  if (dosageRecord.rows.length === 0) {
    return null
  }

  const actualDosage = metric === 'residual_chlorine'
    ? dosageRecord.rows[0].disinfectant_dosage
    : dosageRecord.rows[0].flocculant_dosage

  const parentDeviationId = await findRecurrenceDeviation(metric, affectStartTime)
  const isRecurrence = parentDeviationId !== null

  const description = metric === 'residual_chlorine'
    ? `在线余氯连续${consecutiveCount}小时偏低，实际${actualValue}mg/L，低于阈值${threshold}mg/L`
    : `浊度连续${consecutiveCount}小时偏高，实际${actualValue}NTU，高于阈值${threshold}NTU`

  const result = await pool.query(
    `
    INSERT INTO deviation_records
    (dosage_record_id, type, deviation_metric, description, status,
     actual_dosage, actual_value, threshold_value, consecutive_hours,
     affect_start_time, affect_end_time, parent_deviation_id, is_recurrence)
    VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
    `,
    [
      startDosageRecordId,
      type,
      metric,
      description,
      actualDosage,
      actualValue,
      threshold,
      consecutiveCount,
      affectStartTime,
      affectEndTime,
      parentDeviationId,
      isRecurrence
    ]
  )

  return result.rows[0]?.id || null
}

export const updateExistingDeviationRange = async (
  deviationId: number,
  newEndTime: Date,
  consecutiveCount: number,
  actualValue: number
): Promise<void> => {
  await pool.query(
    `
    UPDATE deviation_records
    SET affect_end_time = $1,
        consecutive_hours = $2,
        actual_value = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    `,
    [newEndTime, consecutiveCount, actualValue, deviationId]
  )
}

export const getDeviationById = async (id: number) => {
  const result = await pool.query(
    `
    SELECT d.*, dr.record_time, dr.hour, dr.disinfectant_dosage,
           dr.flocculant_dosage, dr.online_residual_chlorine,
           u1.name as analyst_name, u2.name as supervisor_name,
           EXISTS (SELECT 1 FROM water_quality_records w WHERE w.dosage_record_id = d.dosage_record_id) as has_quality_record
    FROM deviation_records d
    LEFT JOIN dosage_records dr ON d.dosage_record_id = dr.id
    LEFT JOIN users u1 ON d.analyst_id = u1.id
    LEFT JOIN users u2 ON d.supervisor_id = u2.id
    WHERE d.id = $1
    `,
    [id]
  )
  return result.rows[0] || null
}

export const getRecurrenceDeviations = async (parentId: number) => {
  const result = await pool.query(
    `
    SELECT d.*, dr.record_time, dr.hour
    FROM deviation_records d
    LEFT JOIN dosage_records dr ON d.dosage_record_id = dr.id
    WHERE d.parent_deviation_id = $1
    ORDER BY d.generated_at DESC
    `,
    [parentId]
  )
  return result.rows
}

export default {
  checkConsecutiveDeviation,
  findRecurrenceDeviation,
  hasActiveDeviation,
  createDeviationFromConsecutive,
  updateExistingDeviationRange,
  getDeviationById,
  getRecurrenceDeviations
}
