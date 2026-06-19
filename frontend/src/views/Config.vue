<template>
  <div class="config-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统配置</span>
          <el-button type="primary" :loading="saving" @click="handleSave">
            <el-icon><Check /></el-icon>
            保存配置
          </el-button>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form :model="form" label-width="160px">
            <h3 style="margin-bottom: 16px; color: #303133">水质标准配置</h3>
            <el-form-item label="余氯下限(mg/L)">
              <el-input-number v-model="form.residual_chlorine_min" :min="0" :precision="3" :step="0.01" style="width: 100%" />
            </el-form-item>
            <el-form-item label="余氯上限(mg/L)">
              <el-input-number v-model="form.residual_chlorine_max" :min="0" :precision="3" :step="0.01" style="width: 100%" />
            </el-form-item>
            <el-form-item label="浊度上限(NTU)">
              <el-input-number v-model="form.turbidity_max" :min="0" :precision="3" :step="0.01" style="width: 100%" />
            </el-form-item>
            <el-form-item label="pH下限">
              <el-input-number v-model="form.ph_min" :min="0" :max="14" :precision="2" :step="0.1" style="width: 100%" />
            </el-form-item>
            <el-form-item label="pH上限">
              <el-input-number v-model="form.ph_max" :min="0" :max="14" :precision="2" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="12">
          <el-form label-width="160px">
            <h3 style="margin-bottom: 16px; color: #303133">药剂投加标准</h3>
            <el-form-item label="絮凝剂标准投加量(mg/L)">
              <el-input-number v-model="form.flocculant_standard" :min="0" :precision="2" :step="0.1" style="width: 100%" />
            </el-form-item>
            <el-form-item label="消毒剂标准投加量(mg/L)">
              <el-input-number v-model="form.disinfectant_standard" :min="0" :precision="2" :step="0.1" style="width: 100%" />
            </el-form-item>
          </el-form>

          <el-alert type="info" :closable="false" style="margin-top: 20px">
            <template #title>配置说明</template>
            <p>1. 在线余氯低于"余氯下限"时，系统将自动生成偏差记录</p>
            <p>2. 标准投加量用于数据对比和系统提示参考</p>
            <p>3. 水质标准用于化验结果的合格判定</p>
          </el-alert>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>
        <span>用户管理</span>
      </template>
      <el-table :data="users" v-loading="loading" border stripe>
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTagMap[row.role]">{{ roleMap[row.role] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { getSystemConfigs, batchUpdateConfigs } from '@/api/process'
import { getUsers } from '@/api/auth'
import { roleMap } from '@/types'
import type { SystemConfig, User } from '@/types'
import dayjs from 'dayjs'

const loading = ref(false)
const saving = ref(false)
const users = ref<User[]>([])

const form = reactive({
  residual_chlorine_min: 0.3,
  residual_chlorine_max: 0.5,
  flocculant_standard: 10.0,
  disinfectant_standard: 2.0,
  turbidity_max: 1.0,
  ph_min: 6.5,
  ph_max: 8.5
})

const roleTagMap: Record<string, string> = {
  controller: 'warning',
  analyst: 'primary',
  supervisor: 'danger'
}

const formatDateTime = (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

const loadConfigs = async () => {
  loading.value = true
  try {
    const res = await getSystemConfigs()
    const configs: SystemConfig[] = res.data || []
    configs.forEach(c => {
      if (form.hasOwnProperty(c.config_key as keyof typeof form)) {
        ;(form as any)[c.config_key] = parseFloat(c.config_value)
      }
    })
  } catch (error) {
  } finally {
    loading.value = false
  }
}

const loadUsers = async () => {
  try {
    const res = await getUsers()
    users.value = res.data || []
  } catch (error) {}
}

const handleSave = async () => {
  try {
    saving.value = true
    const configs = [
      { config_key: 'residual_chlorine_min', config_value: form.residual_chlorine_min.toString() },
      { config_key: 'residual_chlorine_max', config_value: form.residual_chlorine_max.toString() },
      { config_key: 'flocculant_standard', config_value: form.flocculant_standard.toString() },
      { config_key: 'disinfectant_standard', config_value: form.disinfectant_standard.toString() },
      { config_key: 'turbidity_max', config_value: form.turbidity_max.toString() },
      { config_key: 'ph_min', config_value: form.ph_min.toString() },
      { config_key: 'ph_max', config_value: form.ph_max.toString() }
    ]
    await batchUpdateConfigs(configs)
    ElMessage.success('配置保存成功')
  } catch (error) {
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfigs()
  loadUsers()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

:deep(.el-alert__description) {
  line-height: 1.8;
}
</style>
