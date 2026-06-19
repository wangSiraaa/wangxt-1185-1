import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import * as authController from '../controllers/authController'
import * as dosageController from '../controllers/dosageController'
import * as waterQualityController from '../controllers/waterQualityController'
import * as deviationController from '../controllers/deviationController'
import * as processController from '../controllers/processController'
import * as configController from '../controllers/configController'

const router = Router()

router.post('/auth/login', authController.login)
router.get('/auth/me', authMiddleware(), authController.getCurrentUser)
router.get('/users', authMiddleware(['supervisor']), authController.getUsers)
router.post('/auth/change-password', authMiddleware(), authController.changePassword)

router.get('/dosage', authMiddleware(), dosageController.getDosageRecords)
router.get('/dosage/:id', authMiddleware(), dosageController.getDosageRecordById)
router.post('/dosage', authMiddleware(['controller', 'supervisor']), dosageController.createDosageRecord)

router.get('/water-quality', authMiddleware(), waterQualityController.getWaterQualityRecords)
router.post('/water-quality', authMiddleware(['analyst', 'supervisor']), waterQualityController.createWaterQualityRecord)
router.get('/water-quality/pending', authMiddleware(['analyst', 'supervisor']), waterQualityController.getPendingForAnalyst)

router.get('/deviation', authMiddleware(), deviationController.getDeviationRecords)
router.post('/deviation/manual', authMiddleware(['analyst', 'supervisor']), deviationController.createManualDeviation)
router.put('/deviation/:id/analyst', authMiddleware(['analyst', 'supervisor']), deviationController.submitAnalystOpinion)
router.put('/deviation/:id/confirm', authMiddleware(['supervisor']), deviationController.confirmBySupervisor)
router.put('/deviation/:id/close', authMiddleware(['supervisor']), deviationController.closeDeviation)

router.get('/process-adjustment', authMiddleware(), processController.getProcessAdjustments)
router.post('/process-adjustment', authMiddleware(['supervisor']), processController.createProcessAdjustment)
router.get('/statistics', authMiddleware(), processController.getStatistics)

router.get('/config', authMiddleware(), configController.getSystemConfigs)
router.put('/config', authMiddleware(['supervisor']), configController.updateSystemConfig)
router.put('/config/batch', authMiddleware(['supervisor']), configController.batchUpdateConfigs)

export default router
