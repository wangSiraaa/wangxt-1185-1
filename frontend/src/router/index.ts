import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '首页概览', icon: 'DataLine' }
      },
      {
        path: 'dosage',
        name: 'Dosage',
        component: () => import('@/views/Dosage.vue'),
        meta: { title: '药剂投加记录', icon: 'CirclePlus', roles: ['controller', 'supervisor'] }
      },
      {
        path: 'water-quality',
        name: 'WaterQuality',
        component: () => import('@/views/WaterQuality.vue'),
        meta: { title: '出厂水指标', icon: 'Watermelon', roles: ['analyst', 'supervisor'] }
      },
      {
        path: 'deviation',
        name: 'Deviation',
        component: () => import('@/views/Deviation.vue'),
        meta: { title: '偏差管理', icon: 'Warning' }
      },
      {
        path: 'process-adjustment',
        name: 'ProcessAdjustment',
        component: () => import('@/views/ProcessAdjustment.vue'),
        meta: { title: '工艺调整记录', icon: 'Operation', roles: ['supervisor'] }
      },
      {
        path: 'config',
        name: 'Config',
        component: () => import('@/views/Config.vue'),
        meta: { title: '系统配置', icon: 'Setting', roles: ['supervisor'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth !== false && !userStore.isLoggedIn) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if (to.path === '/login' && userStore.isLoggedIn) {
    next('/')
  } else if (to.meta.roles && !userStore.hasRole(to.meta.roles as any[])) {
    next('/')
  } else {
    next()
  }
})

export default router
