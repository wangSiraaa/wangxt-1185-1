import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole } from '@/types'
import { login as apiLogin, getCurrentUser } from '@/api/auth'
import { roleMap } from '@/types'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => user.value?.role)
  const userName = computed(() => user.value?.name)
  const userRoleText = computed(() => user.value ? roleMap[user.value.role] : '')

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password)
    token.value = res.data.token
    user.value = res.data.user
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    return res.data
  }

  const logout = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const fetchCurrentUser = async () => {
    try {
      const res = await getCurrentUser()
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    } catch (error) {
      logout()
    }
  }

  const hasRole = (roles: UserRole[]) => {
    return user.value ? roles.includes(user.value.role) : false
  }

  return {
    token,
    user,
    isLoggedIn,
    userRole,
    userName,
    userRoleText,
    login,
    logout,
    fetchCurrentUser,
    hasRole
  }
})
