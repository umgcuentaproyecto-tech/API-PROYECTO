const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finanzasController');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

const permittedRoles = ['ADMIN', 'OPERADOR', 'FINANZAS', 'AUDITOR'];

router.get('/saldos', requireAuth, requireRole(...permittedRoles), financeController.getBalanceReport);
router.get('/saldos/tipo-cuenta', requireAuth, requireRole(...permittedRoles), financeController.getBalanceByType);
router.get('/saldos/historico', requireAuth, requireRole(...permittedRoles), financeController.getBalanceHistory);
router.get('/movimientos/resumen-diario', requireAuth, requireRole(...permittedRoles), financeController.getDailyTransferSummary);
router.get('/movimientos/por-banco', requireAuth, requireRole(...permittedRoles), financeController.getVolumeByBank);
router.get('/movimientos/montos', requireAuth, requireRole(...permittedRoles), financeController.getTotalsMoved);
router.get('/estado-cuenta/:accountId', requireAuth, requireRole(...permittedRoles), financeController.getAccountStatement);
router.get('/alertas', requireAuth, requireRole(...permittedRoles), financeController.getAlerts);
router.get('/dashboard', requireAuth, requireRole(...permittedRoles), financeController.getDashboardSummary);

module.exports = router;
