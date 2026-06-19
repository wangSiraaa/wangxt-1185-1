<template>
  <div class="water-quality-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>出厂水指标</span>
          <div class="header-actions">
            <el-date-picker v-model="queryDate" type="date" placeholder="选择日期" @change="loadData" />
            <el-button v-if="userStore.hasRole(['analyst', 'supervisor'])" type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              录入化验结果
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
        <el-table-column prop="turbidity" label="浊度(NTU)" width="120" align="center" />
        <el-table-column prop="ph" label="pH值" width="100" align="center" />
        <el-table-column prop="residual_chlorine" label="余氯(mg/L)" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.residual_chlorine < 0.3 ? 'danger' : 'success'" size="small">
              {{ row.residual_chlorine }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="coli_group" label="大肠菌群" width="100" align="center" />
        <el-table-column prop="total_bacteria" label="细菌总数" width="100" align="center" />
        <el-table-column prop="analyst_name" label="化验员" width="100" />
        <el-table-column prop="record_time" label="化验时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.record_time) }}
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

    <el-dialog v-model="showAddDialog" title="录入化验结果" width="500px" @close="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item prop="dosage_record_id" label="关联时段">
          <el-select v-model="form.dosage_record_id" placeholder="选择时段" style="width: 100%" filterable>
            <el-option
              v-for="item in pendingList"
              :key="item.id"
              :label="`${item.record_time} ${item.hour.toString().padStart(2, '0')}:00`"
              :value="item.id"
            >
              <span style="float: left">{{ item.record_time }} {{ item.hour.toString().padStart(2, '0') }}:00</span>
              <el-tag v-if="item.has_deviation" type="warning" size="small" style="float: right">有偏差</el-tag>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item prop="turbidity" label="浊度(NTU)">
          <el-input-number v-model="form.turbidity" :min="0" :precision="3" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="ph" label="pH值">
          <el-input-number v-model="form.ph" :min="0" :max="14" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="residual_chlorine" label="余氯(mg/L)">
          <el-input-number v-model="form.residual_chlorine" :min="0" :precision="3" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="coli_group" label="大肠菌群">
          <el-select v-model="form.coli_group" style="width: 100%">
            <el-option label="未检出" value="未检出" />
            <el-option label="检出" value="检出" />
          </el-select>
        </el-form-item>
        <el-form-item prop="total_bacteria" label="细菌总数">
          <el-select v-model="form.total_bacteria" style="width: 100%">
            <el-option label="合格" value="合格" />
            <el-option label="不合格" value="不合格" />
          </el-select>
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
import { Plus } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { getWaterQualityRecords, createWaterQualityRecord, getPendingForAnalyst } from '@/api/waterQuality'
import dayjs from 'dayjs'
import type { WaterQualityRecord, DosageRecord } from '@/types'

const userStore = useUserStore()
const loading = ref(false)
const submitting = ref(false)
const showAddDialog = ref(false)
const queryDate = ref(dayjs().format('YYYY-MM-DD'))
const tableData = ref<WaterQualityRecord[]>([])
const pendingList = ref<DosageRecord[]>([])
const formRef = ref<FormInstance>()

const pagination = reactive({
  page: 1,
  pageSize: 24,
  total: 0
})

const form = reactive({
  dosage_record_id: undefined as number | undefined,
  turbidity: 0.5,
  ph: 7.5,
  residual_chlorine: 0.4,
  coli_group: '未检出',
  total_bacteria: '合格'
})

const rules: FormRules = {
  dosage_record_id: [{ required: true, message: '请选择关联时段', trigger: 'change' }],
  turbidity: [{ required: true, message: '请输入浊度', trigger: 'blur' }],
  ph: [{ required: true, message: '请输入pH值', trigger: 'blur' }],
  residual_chlorine: [{ required: true, message: '请输入余氯值', trigger: 'blur' }],
  coli_group: [{ required: true, message: '请选择大肠菌群结果', trigger: 'change' }],
  total_bacteria: [{ required: true, message: '请选择细菌总数结果', trigger: 'change' }]
}

const formatDateTime = (date: string) => dayjs(date).format('MM-DD HH:mm')

const loadData = async () => {
  loading.value = true
  try {
    const res = await getWaterQualityRecords({
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

const loadPendingList = async () => {
  try {
    const res = await getPendingForAnalyst()
    pendingList.value = res.data || []
  } catch (error) {}
}

const resetForm = () => {
  form.dosage_record_id = undefined
  form.turbidity = 0.5
  form.ph = 7.5
  form.residual_chlorine = 0.4
  form.coli_group = '未检出'
  form.total_bacteria = '合格'
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        submitting.value = true
        await createWaterQualityRecord(form)
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
  loadPendingList()
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
