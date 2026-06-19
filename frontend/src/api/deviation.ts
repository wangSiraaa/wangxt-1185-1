import request from './request'
import type { DeviationRecord, ApiResponse } from '@/types'

export interface DeviationQueryParams {
  status?: string
  page?: number
  pageSize?: number
}

export const getDeviationRecords = (params: DeviationQueryParams = {}) => {
  return request.get<ApiResponse<DeviationRecord[]>>('/deviation', { params })
}

export const createManualDeviation = (data: Partial<DeviationRecord>) => {
  return request.post<DeviationRecord>('/deviation/manual', data)
}

export const submitAnalystOpinion = (id: number, data: { analyst_opinion: string; suggested_dosage?: number }) => {
  return request.put<DeviationRecord>(`/deviation/${id}/analyst`, data)
}

export const confirmBySupervisor = (id: number, data: { supervisor_opinion: string; need_adjustment: boolean }) => {
  return request.put<DeviationRecord>(`/deviation/${id}/confirm`, data)
}

export const closeDeviation = (id: number) => {
  return request.put<DeviationRecord>(`/deviation/${id}/close`)
}
