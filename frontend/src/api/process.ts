import request from './request'
import type { ProcessAdjustment, SystemConfig, ApiResponse } from '@/types'

export interface ProcessQueryParams {
  page?: number
  pageSize?: number
}

export const getProcessAdjustments = (params: ProcessQueryParams = {}) => {
  return request.get<ApiResponse<ProcessAdjustment[]>>('/process-adjustment', { params })
}

export const createProcessAdjustment = (data: Partial<ProcessAdjustment>) => {
  return request.post<ProcessAdjustment>('/process-adjustment', data)
}

export const getStatistics = (params?: { start_date?: string; end_date?: string }) => {
  return request.get('/statistics', { params })
}

export const getSystemConfigs = () => {
  return request.get<SystemConfig[]>('/config')
}

export const updateSystemConfig = (config_key: string, config_value: string) => {
  return request.put('/config', { config_key, config_value })
}

export const batchUpdateConfigs = (configs: { config_key: string; config_value: string }[]) => {
  return request.put('/config/batch', { configs })
}
