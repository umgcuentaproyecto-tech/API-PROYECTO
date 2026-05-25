const express = require('express');
const router = express.Router();
const accountController = require('../controllers/cuentaController');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

// Protegidas: ADMIN, OPERADOR
router.get('/', requireAuth, requireRole('ADMIN', 'OPERADOR'), accountController.getAllAccounts);
router.get('/:id', requireAuth, requireRole('ADMIN', 'OPERADOR'), accountController.getAccountById);
router.get('/numero/:accountNumber', requireAuth, requireRole('ADMIN', 'OPERADOR'), accountController.getAccountBalance);

// Solo ADMIN
router.post('/', requireAuth, requireRole('ADMIN'), accountController.createAccount);
router.put('/:id', requireAuth, requireRole('ADMIN'), accountController.updateAccount);
router.delete('/:id', requireAuth, requireRole('ADMIN'), accountController.deleteAccount);
router.post('/:id/cerrar', requireAuth, requireRole('ADMIN'), accountController.closeAccount);
router.get('/cliente/:clientId', requireAuth, requireRole('ADMIN', 'OPERADOR'), accountController.getAccountsByClient);

module.exports = router;
