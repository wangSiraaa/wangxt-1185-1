import request from './request'
import type { WaterQualityRecord, ApiResponse, DosageRecord } from '@/types'

export interface WaterQualityQueryParams {
  date?: string
  page?: number
  pageSize?: number
}

export const getWaterQualityRecords = (params: WaterQualityQueryParams = {}) => {
  return request.get<ApiResponse<WaterQualityRecord[]>>('/water-quality', { params })
}

export const createWaterQualityRecord = (data: Partial<WaterQualityRecord>) => {
  return request.post<WaterQualityRecord>('/water-quality', data)
}

export const getPendingForAnalyst = () => {
  return request.get<DosageRecord[]>('/water-quality/pending')
}
