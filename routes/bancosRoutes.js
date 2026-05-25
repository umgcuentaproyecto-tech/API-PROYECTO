const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bancoController');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

// Público
router.get('/', bankController.getAllBanks);
router.get('/:id', bankController.getBankById);

// Solo ADMIN
router.post('/', requireAuth, requireRole('ADMIN'), bankController.createBank);
router.put('/:id', requireAuth, requireRole('ADMIN'), bankController.updateBank);
router.delete('/:id', requireAuth, requireRole('ADMIN'), bankController.deleteBank);
router.patch('/:id/toggle-status', requireAuth, requireRole('ADMIN'), bankController.toggleBankStatus);

module.exports = router;
