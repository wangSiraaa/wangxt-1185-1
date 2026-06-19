<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="stat in statistics" :key="stat.label">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-icon" :style="{ background: stat.color }">
              <el-icon :size="28"><component :is="stat.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>近24小时投加量趋势</span>
          </template>
          <div ref="dosageChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>近24小时余氯趋势</span>
          </template>
          <div ref="chlorineChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待处理偏差</span>
              <el-button type="primary" link @click="router.push('/deviation')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="pendingDeviations" v-loading="loading">
            <el-table-column prop="id" label="编号" width="80" />
            <el-table-column prop="description" label="偏差描述" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusColorMap[row.status]" size="small">{{ statusMap[row.status] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="generated_at" label="生成时间" width="160">
              <template #default="{ row }">
                {{ formatDateTime(row.generated_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近工艺调整</span>
              <el-button v-if="userStore.hasRole(['supervisor'])" type="primary" link @click="router.push('/process-adjustment')">
                查看全部
              </el-button>
            </div>
          </template>
          <el-table :data="recentAdjustments" v-loading="loading">
            <el-table-column prop="adjustment_type" label="调整类型" width="120" />
            <el-table-column prop="description" label="调整说明" show-overflow-tooltip />
            <el-table-column label="调整值" width="140">
              <template #default="{ row }">
                {{ row.before_value }} → {{ row.after_value }}
              </template>
            </el-table-column>
            <el-table-column prop="operator_name" label="操作人" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { DataLine, CirclePlus, Watermelon, Warning, Operation } from '@element-plus/icons-vue'
import { getDosageRecords } from '@/api/dosage'
import { getDeviationRecords } from '@/api/deviation'
import { getProcessAdjustments, getStatistics } from '@/api/process'
import { useUserStore } from '@/store/user'
import { statusMap, statusColorMap } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const dosageChartRef = ref<HTMLElement>()
const chlorineChartRef = ref<HTMLElement>()
const pendingDeviations = ref<any[]>([])
const recentAdjustments = ref<any[]>([])
const statistics = ref<any[]>([])

const formatDateTime = (date: string) => dayjs(date).format('MM-DD HH:mm')

const loadData = async () => {
  loading.value = true
  try {
    const [statsRes, devRes, adjRes, dosageRes] = await Promise.all([
      getStatistics(),
      getDeviationRecords({ pageSize: 5 }),
      getProcessAdjustments({ pageSize: 5 }),
      getDosageRecords({ pageSize: 24 })
    ])

    const stats = statsRes.data
    statistics.value = [
      { label: '今日投加记录', value: stats.dosage?.total_records || 0, icon: CirclePlus, color: '#409EFF' },
      { label: '平均絮凝剂', value: Number(stats.dosage?.avg_flocculant || 0).toFixed(2), icon: DataLine, color: '#67C23A' },
      { label: '平均消毒剂', value: Number(stats.dosage?.avg_disinfectant || 0).toFixed(2), icon: Watermelon, color: '#E6A23C' },
      { label: '待处理偏差', value: stats.deviation?.pending_count || 0, icon: Warning, color: '#F56C6C' }
    ]

    pendingDeviations.value = devRes.data?.data?.filter((d: any) => d.status !== 'closed') || []
    recentAdjustments.value = adjRes.data?.data || []

    await nextTick()
    initDosageChart(dosageRes.data?.data || [])
    initChlorineChart(dosageRes.data?.data || [])
  } catch (error) {
  } finally {
    loading.value = false
  }
}

const initDosageChart = (data: any[]) => {
  if (!dosageChartRef.value) return
  const sorted = [...data].sort((a, b) => a.hour - b.hour)
  const chart = echarts.init(dosageChartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['絮凝剂', '消毒剂'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: sorted.map(d => `${d.hour}时`) },
    yAxis: { type: 'value' },
    series: [
      { name: '絮凝剂', type: 'line', smooth: true, data: sorted.map(d => d.flocculant_dosage), itemStyle: { color: '#67C23A' } },
      { name: '消毒剂', type: 'line', smooth: true, data: sorted.map(d => d.disinfectant_dosage), itemStyle: { color: '#E6A23C' } }
    ]
  })
}

const initChlorineChart = (data: any[]) => {
  if (!chlorineChartRef.value) return
  const sorted = [...data].sort((a, b) => a.hour - b.hour)
  const chart = echarts.init(chlorineChartRef.value)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['在线余氯'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: sorted.map(d => `${d.hour}时`) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '在线余氯',
        type: 'line',
        smooth: true,
        data: sorted.map(d => d.online_residual_chlorine),
        itemStyle: { color: '#409EFF' },
        markLine: {
          data: [{ yAxis: 0.3, name: '下限', lineStyle: { color: '#F56C6C', type: 'dashed' } }]
        }
      }
    ]
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.stat-card {
  margin-bottom: 0;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
