<template>
  <div class="process-adjustment-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>工艺调整记录</span>
          <el-button type="primary" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            新增调整
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" border stripe>
        <el-table-column prop="id" label="编号" width="80" align="center" />
        <el-table-column prop="adjustment_type" label="调整类型" width="140" align="center" />
        <el-table-column prop="description" label="调整说明" min-width="200" show-overflow-tooltip />
        <el-table-column label="调整值" width="160" align="center">
          <template #default="{ row }">
            <span style="color: #F56C6C">{{ row.before_value }}</span>
            <el-icon style="margin: 0 8px; color: #909399"><ArrowRight /></el-icon>
            <span style="color: #67C23A">{{ row.after_value }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="effective_time" label="生效时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.effective_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="operator_name" label="操作人" width="100" />
        <el-table-column prop="deviation_type" label="关联偏差" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.deviation_type" size="small">{{ typeMap[row.deviation_type as keyof typeof typeMap] }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
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

    <el-dialog v-model="showAddDialog" title="新增工艺调整" width="500px" @close="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item prop="deviation_record_id" label="关联偏差">
          <el-select v-model="form.deviation_record_id" placeholder="选择已确认的偏差" clearable style="width: 100%" filterable>
            <el-option
              v-for="item in confirmedDeviations"
              :key="item.id"
              :label="`#${item.id} ${item.description.slice(0, 20)}...`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="adjustment_type" label="调整类型">
          <el-select v-model="form.adjustment_type" style="width: 100%">
            <el-option label="消毒剂投加量调整" value="消毒剂投加量" />
            <el-option label="絮凝剂投加量调整" value="絮凝剂投加量" />
            <el-option label="混合速度调整" value="混合速度" />
            <el-option label="反应时间调整" value="反应时间" />
            <el-option label="pH值调整" value="pH值" />
            <el-option label="其他调整" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item prop="description" label="调整说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请详细描述调整原因和内容" />
        </el-form-item>
        <el-form-item prop="before_value" label="调整前数值">
          <el-input-number v-model="form.before_value" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="after_value" label="调整后数值">
          <el-input-number v-model="form.after_value" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="effective_time" label="生效时间">
          <el-date-picker
            v-model="form.effective_time"
            type="datetime"
            placeholder="选择生效时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, ArrowRight } from '@element-plus/icons-vue'
import { getProcessAdjustments, createProcessAdjustment } from '@/api/process'
import { getDeviationRecords } from '@/api/deviation'
import { typeMap } from '@/types'
import dayjs from 'dayjs'
import type { ProcessAdjustment, DeviationRecord } from '@/types'

const loading = ref(false)
const submitting = ref(false)
const showAddDialog = ref(false)
const tableData = ref<ProcessAdjustment[]>([])
const confirmedDeviations = ref<DeviationRecord[]>([])
const formRef = ref<FormInstance>()

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const form = reactive({
  deviation_record_id: undefined as number | undefined,
  adjustment_type: '消毒剂投加量',
  description: '',
  before_value: 2.0,
  after_value: 2.5,
  effective_time: dayjs().format('YYYY-MM-DD HH:mm:ss')
})

const rules: FormRules = {
  adjustment_type: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  description: [{ required: true, message: '请输入调整说明', trigger: 'blur' }],
  before_value: [{ required: true, message: '请输入调整前数值', trigger: 'blur' }],
  after_value: [{ required: true, message: '请输入调整后数值', trigger: 'blur' }],
  effective_time: [{ required: true, message: '请选择生效时间', trigger: 'change' }]
}

const formatDateTime = (date: string) => dayjs(date).format('MM-DD HH:mm')

const loadData = async () => {
  loading.value = true
  try {
    const res = await getProcessAdjustments({
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

const loadConfirmedDeviations = async () => {
  try {
    const res = await getDeviationRecords({ status: 'confirmed', pageSize: 100 })
    confirmedDeviations.value = res.data?.data || []
  } catch (error) {}
}

const resetForm = () => {
  form.deviation_record_id = undefined
  form.adjustment_type = '消毒剂投加量'
  form.description = ''
  form.before_value = 2.0
  form.after_value = 2.5
  form.effective_time = dayjs().format('YYYY-MM-DD HH:mm:ss')
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        await createProcessAdjustment(form)
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
  loadConfirmedDeviations()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
