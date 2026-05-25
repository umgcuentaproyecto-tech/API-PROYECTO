const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferenciaController');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/middlewareAutenticacion');

// Público
router.get('/config', transferController.getConfig);
router.get('/catalogos', transferController.getCatalogs);
router.post('/validar', transferController.validateTransfer);
router.post('/interbancaria/entrante', transferController.createTransfer);
router.post('/', optionalAuth, transferController.createTransfer);
router.post('/notificacion-resultado', transferController.receiveNotification);
router.post('/validar-cuenta-destino', transferController.validateDestinationAccount);
router.post('/validar-cuenta-externa', transferController.validateAccountAtBank);

// Protegido
router.get('/', requireAuth, requireRole('ADMIN', 'OPERADOR'), transferController.getAllTransfers);

module.exports = router;
