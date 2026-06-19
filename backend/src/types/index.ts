export type UserRole = 'controller' | 'analyst' | 'supervisor'

export interface User {
  id: number
  username: string
  name: string
  role: UserRole
  password_hash: string
  created_at: Date
  updated_at: Date
}

export interface DosageRecord {
  id: number
  record_time: Date
  hour: number
  flocculant_dosage: number
  disinfectant_dosage: number
  online_residual_chlorine: number
  controller_id: number
  is_locked: boolean
  created_at: Date
  updated_at: Date
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
  record_time: Date
  created_at: Date
  updated_at: Date
}

export type DeviationStatus = 'pending' | 'analyst_submitted' | 'confirmed' | 'closed'

export type DeviationType = 'low_chlorine' | 'manual'

export interface DeviationRecord {
  id: number
  dosage_record_id: number
  type: DeviationType
  description: string
  status: DeviationStatus
  actual_dosage: number
  suggested_dosage: number
  analyst_opinion: string
  supervisor_opinion: string
  analyst_id: number | null
  supervisor_id: number | null
  generated_at: Date
  analyst_submitted_at: Date | null
  supervisor_confirmed_at: Date | null
  closed_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface ProcessAdjustment {
  id: number
  deviation_record_id: number | null
  adjustment_type: string
  description: string
  before_value: number
  after_value: number
  effective_time: Date
  operator_id: number
  created_at: Date
  updated_at: Date
}

export interface SystemConfig {
  id: number
  config_key: string
  config_value: string
  description: string
  updated_at: Date
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  total?: number
}
