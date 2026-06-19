import { Response } from 'express'
import { ApiResponse } from '../types'

export const successResponse = <T>(res: Response, data?: T, message = '操作成功', total?: number) => {
  const response: ApiResponse<T> = { success: true, message }
  if (data !== undefined) response.data = data
  if (total !== undefined) response.total = total
  return res.json(response)
}

export const errorResponse = (res: Response, message: string, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, message })
}
