<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="28" color="#409EFF"><HotWater /></el-icon>
        <span>药剂投加复核系统</span>
      </div>
      <el-menu :default-active="activeMenu" router background-color="#001529" text-color="#b6c2cd" active-text-color="#ffffff">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="breadcrumb">
          <el-icon><Location /></el-icon>
          <span>{{ currentTitle }}</span>
        </div>
        <div class="user-info">
          <el-tag :type="roleTagType" size="small">{{ userStore.userRoleText }}</el-tag>
          <span class="username">{{ userStore.userName }}</span>
          <el-dropdown @command="handleCommand">
            <el-button text>
              <el-icon><Avatar /></el-icon>
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
    <password-dialog v-model="showPasswordDialog" />
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { HotWater, Location, Avatar, ArrowDown, DataLine, CirclePlus, Watermelon, Warning, Operation, Setting } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import PasswordDialog from '@/components/PasswordDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const showPasswordDialog = ref(false)

const activeMenu = computed(() => route.path)

const menuItems = computed(() => {
  const allItems = [
    { path: '/dashboard', title: '首页概览', icon: DataLine },
    { path: '/dosage', title: '药剂投加记录', icon: CirclePlus, roles: ['controller', 'supervisor'] },
    { path: '/water-quality', title: '出厂水指标', icon: Watermelon, roles: ['analyst', 'supervisor'] },
    { path: '/deviation', title: '偏差管理', icon: Warning },
    { path: '/process-adjustment', title: '工艺调整记录', icon: Operation, roles: ['supervisor'] },
    { path: '/config', title: '系统配置', icon: Setting, roles: ['supervisor'] }
  ]
  return allItems.filter(item => {
    if (!item.roles) return true
    return userStore.hasRole(item.roles as any[])
  })
})

const currentTitle = computed(() => {
  const item = menuItems.value.find(m => m.path === route.path)
  return item?.title || ''
})

const roleTagType = computed(() => {
  const map: Record<string, string> = {
    controller: 'warning',
    analyst: 'primary',
    supervisor: 'danger'
  }
  return map[userStore.userRole || ''] || 'info'
})

const handleCommand = (command: string) => {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    }).catch(() => {})
  } else if (command === 'password') {
    showPasswordDialog.value = true
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background: #001529;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.el-menu {
  border-right: none;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #606266;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-size: 14px;
  color: #606266;
}

.main {
  background: #f0f2f5;
  padding: 20px;
  overflow: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
