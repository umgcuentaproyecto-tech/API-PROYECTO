const Transfer = require('../models/transferenciaModel');

exports.getAllTransfers = async (req, res) => {
  try {
    const transfers = await Transfer.findAll();
    res.json({
      success: true,
      data: transfers,
      count: transfers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener transferencias',
      error: error.message
    });
  }
};

exports.createTransfer = async (req, res) => {
  try {
    const ipOrigen = req.ip || req.connection.remoteAddress || 'DESCONOCIDO';
    const nombreUsuario = req.user?.nombre || 'DESCONOCIDO';
    const LOCAL_SWIFT = process.env.BANK_SWIFT || 'GTBC6968';
    
    const transferData = {
      ...req.body,
      ipOrigen,
      nombreUsuario
    };
    
//trasferencia externa entrante
    const esTransferenciaEntrante = transferData.swiftOrigen && 
                                     transferData.swiftOrigen !== LOCAL_SWIFT; // Detectar por SWIFT diferente
    
    if (esTransferenciaEntrante) {
      // Transferencia interbancaria entrante
      const result = await Transfer.validateIncoming(transferData);
      
      if (result.status === 'APROBADO') {
        res.status(200).json({
          success: true,
          status: 'APROBADO',
          TransactionID: result.TransactionID,
          message: 'Transferencia interbancaria recibida y aprobada exitosamente',
          data: result.TransactionID
        });
      } else {
        res.status(400).json({
          success: false,
          status: 'RECHAZADO',
          message: result.reason
        });
      }
    } else {
      // Transferencia nueva (local o externa saliente)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Se requiere autenticación para crear transferencias'
        });
      }
      
      const transfer = await Transfer.create(transferData, req.user);
      res.status(201).json({
        success: true,
        message: 'Transferencia registrada',
        data: transfer
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error al registrar transferencia',
      error: error.message
    });
  }
};

exports.validateTransfer = async (req, res) => {
  try {
    const ipOrigen = req.ip || req.connection.remoteAddress || 'DESCONOCIDO';
    const nombreUsuario = req.user?.nombre || 'SISTEMA';
    
    const transferData = {
      ...req.body,
      ipOrigen,
      nombreUsuario
    };
    
    const result = await Transfer.validateIncoming(transferData);
    res.status(result.status === 'APROBADO' ? 200 : 200).json(result);
  } catch (error) {
    res.status(500).json({
      status: 'RECHAZADO',
      reason: error.message
    });
  }
};

exports.validateDestinationAccount = async (req, res) => {
  try {
    const result = await Transfer.validateDestinationAccount(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al validar cuenta destino',
      error: error.message
    });
  }
};

exports.getCatalogs = async (req, res) => {
  try {
    const catalogs = await Transfer.getCatalogs();
    res.json({
      success: true,
      data: catalogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener catalogos de transferencias',
      error: error.message
    });
  }
};

exports.getConfig = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        local_swift: process.env.BANK_SWIFT || 'GTBC6968'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración',
      error: error.message
    });
  }
};

exports.validateAccountAtBank = async (req, res) => {
  try {
    const { numeroCuenta, codigoSwift } = req.body;

    if (!numeroCuenta || !codigoSwift) {
      return res.status(400).json({
        success: false,
        message: 'Número de cuenta y código SWIFT son requeridos'
      });
    }

    const result = await Transfer.validateAccountExternal(numeroCuenta, codigoSwift);

    res.json({
      success: result.existe,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al validar cuenta',
      error: error.message
    });
  }
};

exports.receiveIncomingTransfer = async (req, res) => {
  try {
    const ipOrigen = req.ip || req.connection.remoteAddress || 'DESCONOCIDO';
    const nombreUsuario = req.user?.nombre || 'SISTEMA_EXTERNO';
    
    const transferData = {
      ...req.body,
      ipOrigen,
      nombreUsuario
    };
    
    const result = await Transfer.validateIncoming(transferData);
    
    if (result.status === 'APROBADO') {
      res.status(200).json({
        success: true,
        status: 'APROBADO',
        TransactionID: result.TransactionID,
        message: 'Transferencia interbancaria recibida y aprobada exitosamente'
      });
    } else {
      res.status(400).json({
        success: false,
        status: 'RECHAZADO',
        message: result.reason
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'RECHAZADO',
      message: error.message
    });
  }
};

exports.receiveNotification = async (req, res) => {
  try {
    const { transaction_id, estado, mensaje } = req.body;
    
    if (!transaction_id || !estado) {
      return res.status(400).json({
        success: false,
        message: 'transaction_id y estado son requeridos'
      });
    }

    const result = await Transfer.processNotification(transaction_id, estado, mensaje);
    
    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
