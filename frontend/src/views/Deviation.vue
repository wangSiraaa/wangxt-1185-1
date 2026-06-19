<template>
  <div class="deviation-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>偏差管理</span>
          <div class="header-actions">
            <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 160px" @change="loadData">
              <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-button v-if="userStore.hasRole(['analyst', 'supervisor'])" type="primary" @click="showManualDialog = true">
              <el-icon><Plus /></el-icon>
              人工录入偏差
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="id" label="编号" width="80" align="center" />
        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'low_chlorine' ? 'danger' : 'warning'" size="small">
              {{ typeMap[row.type] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关联时段" width="140">
          <template #default="{ row }">
            {{ row.record_time }} {{ row.hour?.toString().padStart(2, '0') }}:00
          </template>
        </el-table-column>
        <el-table-column prop="description" label="偏差描述" min-width="180" show-overflow-tooltip />
        <el-table-column prop="actual_dosage" label="实际投加量" width="120" align="center" />
        <el-table-column prop="suggested_dosage" label="建议投加量" width="120" align="center" />
        <el-table-column prop="status" label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusColorMap[row.status]" size="small">{{ statusMap[row.status] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="化验结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.has_quality_record" type="success" size="small">已回传</el-tag>
            <el-tag v-else type="danger" size="small">未回传</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="generated_at" label="生成时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.generated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
            <el-button
              v-if="userStore.hasRole(['analyst', 'supervisor']) && row.status === 'pending'"
              type="success" link size="small"
              @click="handleAnalyst(row)"
            >
              提交意见
            </el-button>
            <el-button
              v-if="userStore.hasRole(['supervisor']) && row.status === 'analyst_submitted'"
              type="warning" link size="small"
              @click="handleConfirm(row)"
            >
              主管确认
            </el-button>
            <el-button
              v-if="userStore.hasRole(['supervisor']) && row.status !== 'closed'"
              type="danger" link size="small"
              :disabled="!row.has_quality_record"
              @click="handleClose(row)"
            >
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <el-dialog v-model="showViewDialog" title="偏差详情" width="600px">
      <el-descriptions :column="2" border v-if="currentRecord">
        <el-descriptions-item label="偏差编号">{{ currentRecord.id }}</el-descriptions-item>
        <el-descriptions-item label="偏差类型">
          <el-tag :type="currentRecord.type === 'low_chlorine' ? 'danger' : 'warning'">
            {{ typeMap[currentRecord.type] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联时段">
          {{ currentRecord.record_time }} {{ currentRecord.hour?.toString().padStart(2, '0') }}:00
        </el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag :type="statusColorMap[currentRecord.status]">{{ statusMap[currentRecord.status] }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="实际投加量">{{ currentRecord.actual_dosage }} mg/L</el-descriptions-item>
        <el-descriptions-item label="建议投加量">{{ currentRecord.suggested_dosage || '-' }} mg/L</el-descriptions-item>
        <el-descriptions-item label="在线余氯">{{ currentRecord.online_residual_chlorine }} mg/L</el-descriptions-item>
        <el-descriptions-item label="化验结果">
          <el-tag v-if="currentRecord.has_quality_record" type="success">已回传</el-tag>
          <el-tag v-else type="danger">未回传</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="偏差描述" :span="2">{{ currentRecord.description }}</el-descriptions-item>
        <el-descriptions-item label="化验员意见" :span="2">
          {{ currentRecord.analyst_opinion || '暂无' }}
          <div v-if="currentRecord.analyst_name" class="meta">
            <span>操作人：{{ currentRecord.analyst_name }}</span>
            <span style="margin-left: 20px">时间：{{ formatDateTime(currentRecord.analyst_submitted_at) }}</span>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="主管意见" :span="2">
          {{ currentRecord.supervisor_opinion || '暂无' }}
          <div v-if="currentRecord.supervisor_name" class="meta">
            <span>操作人：{{ currentRecord.supervisor_name }}</span>
            <span style="margin-left: 20px">时间：{{ formatDateTime(currentRecord.supervisor_confirmed_at) }}</span>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="showAnalystDialog" title="提交化验员意见" width="500px" @close="resetAnalystForm">
      <el-alert v-if="!currentRecord?.has_quality_record" type="error" show-icon style="margin-bottom: 16px">
        请先录入该时段的化验结果后再提交意见
      </el-alert>
      <el-form :model="analystForm" :rules="analystRules" ref="analystFormRef" label-width="100px">
        <el-form-item prop="suggested_dosage" label="建议投加量">
          <el-input-number v-model="analystForm.suggested_dosage" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="analyst_opinion" label="复核意见">
          <el-input v-model="analystForm.analyst_opinion" type="textarea" :rows="4" placeholder="请输入化验员复核意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAnalystDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!currentRecord?.has_quality_record" @click="submitAnalystOpinion">
          提交
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showConfirmDialog" title="主管确认" width="500px" @close="resetConfirmForm">
      <el-alert type="warning" show-icon style="margin-bottom: 16px">
        确认后将锁定原始投加记录，不可再修改
      </el-alert>
      <el-form :model="confirmForm" :rules="confirmRules" ref="confirmFormRef" label-width="100px">
        <el-form-item prop="need_adjustment" label="是否调整">
          <el-radio-group v-model="confirmForm.need_adjustment">
            <el-radio :value="true">需要工艺调整</el-radio>
            <el-radio :value="false">无需调整</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item prop="supervisor_opinion" label="复核意见">
          <el-input v-model="confirmForm.supervisor_opinion" type="textarea" :rows="4" placeholder="请输入主管复核意见" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfirmDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitConfirm">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showManualDialog" title="人工录入偏差" width="500px" @close="resetManualForm">
      <el-form :model="manualForm" :rules="manualRules" ref="manualFormRef" label-width="100px">
        <el-form-item prop="dosage_record_id" label="关联时段">
          <el-select v-model="manualForm.dosage_record_id" placeholder="选择时段" style="width: 100%" filterable>
            <el-option
              v-for="item in dosageList"
              :key="item.id"
              :label="`${item.record_time} ${item.hour.toString().padStart(2, '0')}:00`"
              :value="item.id"
              :disabled="item.is_locked"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="description" label="偏差描述">
          <el-input v-model="manualForm.description" type="textarea" :rows="3" placeholder="请描述偏差情况" />
        </el-form-item>
        <el-form-item prop="suggested_dosage" label="建议投加量">
          <el-input-number v-model="manualForm.suggested_dosage" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showManualDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitManual">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { getDeviationRecords, submitAnalystOpinion, confirmBySupervisor, closeDeviation, createManualDeviation } from '@/api/deviation'
import { getDosageRecords } from '@/api/dosage'
import { statusMap, typeMap, statusColorMap } from '@/types'
import dayjs from 'dayjs'
import type { DeviationRecord, DosageRecord } from '@/types'

const userStore = useUserStore()
const loading = ref(false)
const submitting = ref(false)
const statusFilter = ref('')
const tableData = ref<DeviationRecord[]>([])
const dosageList = ref<DosageRecord[]>([])
const currentRecord = ref<DeviationRecord | null>(null)

const showViewDialog = ref(false)
const showAnalystDialog = ref(false)
const showConfirmDialog = ref(false)
const showManualDialog = ref(false)

const analystFormRef = ref<FormInstance>()
const confirmFormRef = ref<FormInstance>()
const manualFormRef = ref<FormInstance>()

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '化验员已提交', value: 'analyst_submitted' },
  { label: '主管已确认', value: 'confirmed' },
  { label: '已关闭', value: 'closed' }
]

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const analystForm = reactive({
  suggested_dosage: 2.0,
  analyst_opinion: ''
})

const confirmForm = reactive({
  need_adjustment: false,
  supervisor_opinion: ''
})

const manualForm = reactive({
  dosage_record_id: undefined as number | undefined,
  description: '',
  suggested_dosage: 2.0
})

const analystRules: FormRules = {
  analyst_opinion: [{ required: true, message: '请输入复核意见', trigger: 'blur' }]
}

const confirmRules: FormRules = {
  supervisor_opinion: [{ required: true, message: '请输入复核意见', trigger: 'blur' }]
}

const manualRules: FormRules = {
  dosage_record_id: [{ required: true, message: '请选择关联时段', trigger: 'change' }],
  description: [{ required: true, message: '请输入偏差描述', trigger: 'blur' }]
}

const formatDateTime = (date?: string) => date ? dayjs(date).format('MM-DD HH:mm') : '-'

const loadData = async () => {
  loading.value = true
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await getDeviationRecords(params)
    tableData.value = res.data?.data || []
    pagination.total = res.data?.total || 0
  } catch (error) {
  } finally {
    loading.value = false
  }
}

const loadDosageList = async () => {
  try {
    const res = await getDosageRecords({ pageSize: 100 })
    dosageList.value = res.data?.data || []
  } catch (error) {}
}

const handleView = (row: DeviationRecord) => {
  currentRecord.value = row
  showViewDialog.value = true
}

const handleAnalyst = (row: DeviationRecord) => {
  currentRecord.value = row
  analystForm.suggested_dosage = row.actual_dosage
  analystForm.analyst_opinion = ''
  showAnalystDialog.value = true
}

const handleConfirm = (row: DeviationRecord) => {
  currentRecord.value = row
  confirmForm.need_adjustment = false
  confirmForm.supervisor_opinion = ''
  showConfirmDialog.value = true
}

const handleClose = async (row: DeviationRecord) => {
  if (!row.has_quality_record) {
    ElMessage.error('化验结果未回传，不能关闭偏差')
    return
  }
  try {
    await ElMessageBox.confirm('确定要关闭该偏差记录吗？', '提示', { type: 'warning' })
    await closeDeviation(row.id)
    ElMessage.success('关闭成功')
    loadData()
  } catch (error) {}
}

const resetAnalystForm = () => {
  analystForm.suggested_dosage = 2.0
  analystForm.analyst_opinion = ''
  analystFormRef.value?.resetFields()
}

const resetConfirmForm = () => {
  confirmForm.need_adjustment = false
  confirmForm.supervisor_opinion = ''
  confirmFormRef.value?.resetFields()
}

const resetManualForm = () => {
  manualForm.dosage_record_id = undefined
  manualForm.description = ''
  manualForm.suggested_dosage = 2.0
  manualFormRef.value?.resetFields()
}

const submitAnalystOpinion = async () => {
  if (!analystFormRef.value || !currentRecord.value) return
  await analystFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        await submitAnalystOpinion(currentRecord.value.id, analystForm)
        ElMessage.success('提交成功')
        showAnalystDialog.value = false
        loadData()
      } catch (error) {
      } finally {
        submitting.value = false
      }
    }
  })
}

const submitConfirm = async () => {
  if (!confirmFormRef.value || !currentRecord.value) return
  await confirmFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        await confirmBySupervisor(currentRecord.value.id, confirmForm)
        ElMessage.success('确认成功，原始投加量已锁定')
        showConfirmDialog.value = false
        loadData()
      } catch (error) {
      } finally {
        submitting.value = false
      }
    }
  })
}

const submitManual = async () => {
  if (!manualFormRef.value) return
  await manualFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        await createManualDeviation(manualForm)
        ElMessage.success('创建成功')
        showManualDialog.value = false
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
  loadDosageList()
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

.meta {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
