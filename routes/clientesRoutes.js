const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clienteController');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

// Protegidas: ADMIN, OPERADOR
router.get('/', requireAuth, requireRole('ADMIN', 'OPERADOR'), clientController.getAllClients);
router.get('/:id', requireAuth, requireRole('ADMIN', 'OPERADOR'), clientController.getClientById);
router.get('/:id/cuentas', requireAuth, requireRole('ADMIN', 'OPERADOR'), clientController.getClientAccounts);

// Solo ADMIN
router.post('/', requireAuth, requireRole('ADMIN'), clientController.createClient);
router.put('/:id', requireAuth, requireRole('ADMIN'), clientController.updateClient);
router.delete('/:id', requireAuth, requireRole('ADMIN'), clientController.deleteClient);

module.exports = router;
