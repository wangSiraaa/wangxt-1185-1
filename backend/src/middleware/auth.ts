import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { UserRole } from '../types'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    role: UserRole
  }
}

export const authMiddleware = (requiredRoles?: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ success: false, message: '未提供认证令牌' })
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'water_plant_jwt_secret_2024') as any
      req.user = decoded

      if (requiredRoles && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ success: false, message: '权限不足' })
      }

      next()
    } catch (error) {
      return res.status(401).json({ success: false, message: '认证令牌无效或已过期' })
    }
  }
}
