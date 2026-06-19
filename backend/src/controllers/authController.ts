import { Response } from 'express'
import pool from '../utils/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AuthRequest } from '../middleware/auth'
import { successResponse, errorResponse } from '../utils/response'
import { User } from '../types'

export const login = async (req: AuthRequest, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    return errorResponse(res, '用户名和密码不能为空')
  }

  const result = await pool.query(
    'SELECT id, username, name, role, password_hash FROM users WHERE username = $1',
    [username]
  )

  if (result.rows.length === 0) {
    return errorResponse(res, '用户名或密码错误')
  }

  const user = result.rows[0]
  const isValid = await bcrypt.compare(password, user.password_hash)

  if (!isValid) {
    return errorResponse(res, '用户名或密码错误')
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'water_plant_jwt_secret_2024',
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '24h' }
  )

  successResponse(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  }, '登录成功')
}

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  successResponse(res, req.user)
}

export const getUsers = async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'SELECT id, username, name, role, created_at FROM users ORDER BY id'
  )
  successResponse(res, result.rows)
}

export const changePassword = async (req: AuthRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body
  const userId = req.user?.id

  if (!oldPassword || !newPassword) {
    return errorResponse(res, '旧密码和新密码不能为空')
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
  const user = result.rows[0]

  const isValid = await bcrypt.compare(oldPassword, user.password_hash)
  if (!isValid) {
    return errorResponse(res, '旧密码错误')
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, userId])

  successResponse(res, null, '密码修改成功')
}
