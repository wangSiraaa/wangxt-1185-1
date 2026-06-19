import request from './request'
import type { DosageRecord, ApiResponse } from '@/types'

export interface DosageQueryParams {
  date?: string
  page?: number
  pageSize?: number
}

export const getDosageRecords = (params: DosageQueryParams = {}) => {
  return request.get<ApiResponse<DosageRecord[]>>('/dosage', { params })
}

export const getDosageRecordById = (id: number) => {
  return request.get<DosageRecord>(`/dosage/${id}`)
}

export const createDosageRecord = (data: Partial<DosageRecord>) => {
  return request.post<DosageRecord>('/dosage', data)
}
