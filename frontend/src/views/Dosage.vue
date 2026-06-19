<template>
  <div class="dosage-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>药剂投加记录</span>
          <div class="header-actions">
            <el-date-picker v-model="queryDate" type="date" placeholder="选择日期" @change="loadData" />
            <el-button v-if="userStore.hasRole(['controller', 'supervisor'])" type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              新增记录
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="record_time" label="日期" width="120" />
        <el-table-column prop="hour" label="时段" width="80" align="center">
          <template #default="{ row }">
            {{ row.hour.toString().padStart(2, '0') }}:00
          </template>
        </el-table-column>
        <el-table-column prop="flocculant_dosage" label="絮凝剂投加量(mg/L)" width="160" align="center" />
        <el-table-column prop="disinfectant_dosage" label="消毒剂投加量(mg/L)" width="160" align="center" />
        <el-table-column prop="online_residual_chlorine" label="在线余氯(mg/L)" width="140" align="center">
          <template #default="{ row }">
            <el-tag :type="row.online_residual_chlorine < 0.3 ? 'danger' : 'success'" size="small">
              {{ row.online_residual_chlorine }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_locked" type="info" size="small">已锁定</el-tag>
            <el-tag v-else type="primary" size="small">编辑中</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="controller_name" label="录入人" width="100" />
        <el-table-column label="关联" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.has_quality_record" type="success" size="small">已化验</el-tag>
            <el-tag v-else type="info" size="small">未化验</el-tag>
            <el-tag v-if="row.has_deviation" type="warning" size="small" style="margin-left: 4px">有偏差</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button type="primary" link :disabled="row.is_locked" @click="handleEdit(row)">
              {{ row.is_locked ? '查看' : '编辑' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <el-dialog v-model="showAddDialog" :title="editData ? '编辑投加记录' : '新增投加记录'" width="500px" @close="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item prop="record_time" label="日期">
          <el-date-picker v-model="form.record_time" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="hour" label="时段">
          <el-select v-model="form.hour" placeholder="选择时段" style="width: 100%">
            <el-option v-for="h in 24" :key="h - 1" :label="`${(h - 1).toString().padStart(2, '0')}:00`" :value="h - 1" />
          </el-select>
        </el-form-item>
        <el-form-item prop="flocculant_dosage" label="絮凝剂投加量">
          <el-input-number v-model="form.flocculant_dosage" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="disinfectant_dosage" label="消毒剂投加量">
          <el-input-number v-model="form.disinfectant_dosage" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="online_residual_chlorine" label="在线余氯">
          <el-input-number v-model="form.online_residual_chlorine" :min="0" :precision="3" :step="0.01" style="width: 100%" />
        </el-form-item>
      </el-form>
      <el-alert v-if="form.online_residual_chlorine && form.online_residual_chlorine < 0.3" type="warning" show-icon style="margin-bottom: 16px">
        余氯低于下限0.3mg/L，保存后将自动生成偏差记录
      </el-alert>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="editData?.is_locked" @click="handleSubmit">
          {{ editData?.is_locked ? '已锁定' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { getDosageRecords, createDosageRecord } from '@/api/dosage'
import dayjs from 'dayjs'
import type { DosageRecord } from '@/types'

const userStore = useUserStore()
const loading = ref(false)
const submitting = ref(false)
const showAddDialog = ref(false)
const queryDate = ref(dayjs().format('YYYY-MM-DD'))
const tableData = ref<DosageRecord[]>([])
const editData = ref<DosageRecord | null>(null)
const formRef = ref<FormInstance>()

const pagination = reactive({
  page: 1,
  pageSize: 24,
  total: 0
})

const form = reactive({
  record_time: dayjs().format('YYYY-MM-DD'),
  hour: dayjs().hour(),
  flocculant_dosage: 10.0,
  disinfectant_dosage: 2.0,
  online_residual_chlorine: 0.35
})

const rules: FormRules = {
  record_time: [{ required: true, message: '请选择日期', trigger: 'change' }],
  hour: [{ required: true, message: '请选择时段', trigger: 'change' }],
  flocculant_dosage: [{ required: true, message: '请输入絮凝剂投加量', trigger: 'blur' }],
  disinfectant_dosage: [{ required: true, message: '请输入消毒剂投加量', trigger: 'blur' }],
  online_residual_chlorine: [{ required: true, message: '请输入在线余氯', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getDosageRecords({
      date: queryDate.value,
      page: pagination.page,
      pageSize: pagination.pageSize
    })
    tableData.value = res.data?.data || []
    pagination.total = res.data?.total || 0
  } catch (error) {
  } finally {
    loading.value = false
  }
}

const handleEdit = (row: DosageRecord) => {
  editData.value = row
  form.record_time = row.record_time
  form.hour = row.hour
  form.flocculant_dosage = row.flocculant_dosage
  form.disinfectant_dosage = row.disinfectant_dosage
  form.online_residual_chlorine = row.online_residual_chlorine
  showAddDialog.value = true
}

const resetForm = () => {
  editData.value = null
  form.record_time = dayjs().format('YYYY-MM-DD')
  form.hour = dayjs().hour()
  form.flocculant_dosage = 10.0
  form.disinfectant_dosage = 2.0
  form.online_residual_chlorine = 0.35
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        await createDosageRecord(form)
        ElMessage.success('保存成功')
        showAddDialog.value = false
        loadData()
      } catch (error) {
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
