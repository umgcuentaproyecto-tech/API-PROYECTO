const Bank = require('../models/bancoModel');
const AuditService = require('../utils/auditService');

exports.getAllBanks = async (req, res) => {
  try {
    const banks = await Bank.findAll();
    res.json({
      success: true,
      data: banks,
      count: banks.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener bancos',
      error: error.message
    });
  }
};

exports.getBankById = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Banco no encontrado'
      });
    }

    res.json({
      success: true,
      data: bank
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener banco',
      error: error.message
    });
  }
};

exports.createBank = async (req, res) => {
  try {
    const { nombre, codigo_swift, url_api, activo } = req.body;

    if (!nombre || !codigo_swift || !url_api) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, código SWIFT y URL API son requeridos'
      });
    }

    const bank = await Bank.create({
      nombre,
      codigo_swift: codigo_swift.toUpperCase(),
      url_api,
      activo: activo !== false
    });

    // Auditoría
    await AuditService.crear('bancos', bank.id_banco, {
      nombre: bank.nombre,
      codigo_swift: bank.codigo_swift
    }, req.user, req);

    res.status(201).json({
      success: true,
      message: 'Banco creado exitosamente',
      data: bank
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateBank = async (req, res) => {
  try {
    const { nombre, codigo_swift, url_api, activo } = req.body;
    const bankId = req.params.id;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (codigo_swift !== undefined) updateData.codigo_swift = codigo_swift.toUpperCase();
    if (url_api !== undefined) updateData.url_api = url_api;
    if (activo !== undefined) updateData.activo = activo;

    const bank = await Bank.update(bankId, updateData);

    // Auditoría
    await AuditService.actualizar('bancos', bankId, {
      nombre: bank.nombre,
      codigo_swift: bank.codigo_swift,
      activo: bank.activo
    }, req.user, req);

    res.json({
      success: true,
      message: 'Banco actualizado exitosamente',
      data: bank
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteBank = async (req, res) => {
  try {
    const bankId = req.params.id;
    const bank = await Bank.findById(bankId);
    await Bank.delete(bankId);

    // Auditoría
    await AuditService.eliminar('bancos', bankId, {
      nombre: bank.nombre,
      codigo_swift: bank.codigo_swift
    }, req.user, req);

    res.json({
      success: true,
      message: 'Banco eliminado exitosamente'
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateEndpoint = async (req, res) => {
  try {
    const { swift } = req.params;
    const { endpoint_transferencia } = req.body;

    if (!endpoint_transferencia) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint es requerido'
      });
    }

    const bank = await Bank.findBySwift(swift);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Banco no encontrado'
      });
    }

    const updatedBank = await Bank.update(bank.id_banco, { endpoint_transferencia });

    // Auditoría
    await AuditService.actualizar('bancos', bank.id_banco, {
      endpoint_transferencia: updatedBank.endpoint_transferencia
    }, req.user, req);

    res.json({
      success: true,
      message: 'Endpoint actualizado exitosamente',
      data: updatedBank
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar endpoint',
      error: error.message
    });
  }
};

exports.toggleBankStatus = async (req, res) => {
  try {
    const { activo } = req.body;
    const bankId = req.params.id;

    if (activo === undefined) {
      return res.status(400).json({
        success: false,
        message: 'El estado activo es requerido'
      });
    }

    const bank = await Bank.toggleActive(bankId, activo);

    res.json({
      success: true,
      message: 'Estado del banco actualizado',
      data: bank
    });
  } catch (error) {
    const statusCode = error.message.includes('no encontrado') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};
