const express = require('express');
const router = express.Router();
const userController = require('../controllers/usuarioController');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/:id/change-password', userController.changePassword);

module.exports = router;
