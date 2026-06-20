export type UserRole = 'controller' | 'analyst' | 'supervisor'

export interface User {
  id: number
  username: string
  name: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  user: User
}

export interface DosageRecord {
  id: number
  record_time: string
  hour: number
  flocculant_dosage: number
  disinfectant_dosage: number
  online_residual_chlorine: number
  controller_id: number
  controller_name?: string
  is_locked: boolean
  has_quality_record?: boolean
  has_deviation?: boolean
  created_at: string
  updated_at: string
}

export interface WaterQualityRecord {
  id: number
  dosage_record_id: number
  turbidity: number
  ph: number
  residual_chlorine: number
  coli_group: string
  total_bacteria: string
  analyst_id: number
  analyst_name?: string
  record_time: string
  record_date?: string
  hour?: number
  created_at: string
  updated_at: string
}

export type DeviationStatus = 'pending' | 'analyst_submitted' | 'confirmed' | 'closed'

export type DeviationType = 'low_chlorine' | 'high_turbidity' | 'manual'

export type DeviationMetric = 'residual_chlorine' | 'turbidity' | 'manual'

export interface DeviationRecord {
  id: number
  dosage_record_id: number
  type: DeviationType
  deviation_metric: DeviationMetric
  description: string
  status: DeviationStatus
  actual_dosage: number
  suggested_dosage?: number
  actual_value?: number
  threshold_value?: number
  consecutive_hours?: number
  affect_start_time?: string
  affect_end_time?: string
  parent_deviation_id?: number
  is_recurrence?: boolean
  analyst_opinion?: string
  supervisor_opinion?: string
  analyst_id?: number
  supervisor_id?: number
  analyst_name?: string
  supervisor_name?: string
  generated_at: string
  analyst_submitted_at?: string
  supervisor_confirmed_at?: string
  closed_at?: string
  created_at: string
  updated_at: string
  record_time?: string
  hour?: number
  disinfectant_dosage?: number
  flocculant_dosage?: number
  online_residual_chlorine?: number
  has_quality_record?: boolean
  parent_deviation?: DeviationRecord | null
  recurrence_deviations?: DeviationRecord[]
}

export interface ProcessAdjustment {
  id: number
  deviation_record_id?: number
  adjustment_type: string
  description: string
  before_value: number
  after_value: number
  effective_time: string
  operator_id: number
  operator_name?: string
  deviation_type?: string
  deviation_desc?: string
  created_at: string
  updated_at: string
}

export interface HourlyMetricData {
  id: number
  record_time: string
  hour: number
  flocculant_dosage: number
  disinfectant_dosage: number
  online_residual_chlorine: number
  turbidity?: number
  lab_residual_chlorine?: number
  time_label: string
}

export interface AdjustmentCompareResponse {
  adjustment: ProcessAdjustment
  compare_hours: number
  before: HourlyMetricData[]
  after: HourlyMetricData[]
  before_average: {
    flocculant: number
    disinfectant: number
    online_residual_chlorine: number
    turbidity: number
  }
  after_average: {
    flocculant: number
    disinfectant: number
    online_residual_chlorine: number
    turbidity: number
  }
  comparison: {
    flocculant_change: number
    disinfectant_change: number
    residual_chlorine_change: number
    turbidity_change: number
  }
}

export interface SystemConfig {
  id: number
  config_key: string
  config_value: string
  description: string
  updated_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  total?: number
}

export const roleMap: Record<UserRole, string> = {
  controller: '中控员',
  analyst: '化验员',
  supervisor: '工艺主管'
}

export const statusMap: Record<DeviationStatus, string> = {
  pending: '待处理(挂起)',
  analyst_submitted: '化验员已提交',
  confirmed: '主管已确认',
  closed: '已关闭'
}

export const typeMap: Record<DeviationType, string> = {
  low_chlorine: '余氯偏低',
  high_turbidity: '浊度偏高',
  manual: '人工录入'
}

export const metricMap: Record<DeviationMetric, string> = {
  residual_chlorine: '余氯',
  turbidity: '浊度',
  manual: '人工'
}

export const statusColorMap: Record<DeviationStatus, string> = {
  pending: 'warning',
  analyst_submitted: 'primary',
  confirmed: 'success',
  closed: 'info'
}
