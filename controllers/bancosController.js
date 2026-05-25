const Bank = require('../models/bancoModel');

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

exports.getBankBySwift = async (req, res) => {
  try {
    const { swift } = req.params;
    const bank = await Bank.findBySwift(swift);
    
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

exports.updateBank = async (req, res) => {
  try {
    const { swift } = req.params;
    const { nombre, url_api, endpoint_transferencia, activo } = req.body;

    if (!nombre && !url_api && !endpoint_transferencia && activo === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un campo para actualizar'
      });
    }

    const bank = await Bank.update(swift, {
      nombre,
      url_api,
      endpoint_transferencia,
      activo
    });

    res.json({
      success: true,
      message: 'Banco actualizado exitosamente',
      data: bank
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar banco',
      error: error.message
    });
  }
};

exports.createBank = async (req, res) => {
  try {
    const { nombre, codigo_swift, url_api, endpoint_transferencia, activo } = req.body;

    if (!nombre || !codigo_swift || !url_api) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, código SWIFT y URL API son requeridos'
      });
    }

    const bank = await Bank.create({
      nombre,
      codigo_swift,
      url_api,
      endpoint_transferencia: endpoint_transferencia || '/api/transferencias/interbancaria/entrante',
      activo: activo !== undefined ? activo : true
    });

    res.status(201).json({
      success: true,
      message: 'Banco creado exitosamente',
      data: bank
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear banco',
      error: error.message
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

    const bank = await Bank.update(swift, { endpoint_transferencia });

    res.json({
      success: true,
      message: 'Endpoint actualizado exitosamente',
      data: bank
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar endpoint',
      error: error.message
    });
  }
};
