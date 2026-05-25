const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaccionController');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

// Crear transacción
router.post('/', requireAuth, requireRole('ADMIN', 'OPERADOR'), transactionController.createTransaction);

// Obtener todas
router.get('/', requireAuth, requireRole('ADMIN', 'OPERADOR'), transactionController.getAllTransactions);

// Por cuenta
router.get('/cuenta/:accountId', requireAuth, requireRole('ADMIN', 'OPERADOR'), transactionController.getAccountTransactions);

module.exports = router;
