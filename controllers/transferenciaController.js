const Transfer = require('../models/transferenciaModel');
const Logger = require('../utils/loggerService');
const logger = new Logger('TransferenciaController');

exports.getAllTransfers = async (req, res) => {
  try {
    logger.info('Obteniendo todas las transferencias');
    const transfers = await Transfer.findAll();
    logger.transferencia('getAllTransfers', 'SUCCESS', { count: transfers.length });
    res.json({
      success: true,
      data: transfers,
      count: transfers.length
    });
  } catch (error) {
    logger.transactionFailed('getAllTransfers', error, { endpoint: '/transferencias' });
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
    
    logger.info('Iniciando creación de transferencia', {
      ipOrigen,
      nombreUsuario,
      monto: transferData.monto,
      swiftOrigen: transferData.swiftOrigen,
      swiftDestino: transferData.swiftDestino
    });

//trasferencia externa entrante
    const esTransferenciaEntrante = transferData.swiftOrigen && 
                                     transferData.swiftOrigen !== LOCAL_SWIFT; // Detectar por SWIFT diferente
    
    if (esTransferenciaEntrante) {
      // Transferencia interbancaria entrante
      logger.info('Detectada transferencia interbancaria entrante', {
        swiftOrigen: transferData.swiftOrigen,
        swiftDestino: transferData.swiftDestino
      });
      
      const result = await Transfer.validateIncoming(transferData);
      
      if (result.status === 'APROBADO') {
        logger.transferencia('createTransfer - Incoming', 'APROBADO', {
          transactionId: result.TransactionID,
          monto: transferData.monto,
          ipOrigen,
          nombreUsuario
        });
        res.status(200).json({
          success: true,
          status: 'APROBADO',
          TransactionID: result.TransactionID,
          message: 'Transferencia interbancaria recibida y aprobada exitosamente',
          data: result.TransactionID
        });
      } else {
        logger.transferencia('createTransfer - Incoming', 'RECHAZADO', {
          razon: result.reason,
          transfer: transferData,
          ipOrigen,
          nombreUsuario
        });
        res.status(400).json({
          success: false,
          status: 'RECHAZADO',
          message: result.reason
        });
      }
    } else {
      // Transferencia nueva (local o externa saliente)
      if (!req.user) {
        logger.warn('Intento de crear transferencia sin autenticación', { ipOrigen });
        return res.status(401).json({
          success: false,
          message: 'Se requiere autenticación para crear transferencias'
        });
      }
      
      logger.info('Creando transferencia local o saliente', {
        cuentaOrigen: transferData.cuentaOrigen,
        cuentaDestino: transferData.cuentaDestino,
        monto: transferData.monto
      });
      
      const transfer = await Transfer.create(transferData, req.user);
      logger.transferencia('createTransfer - Outgoing', 'SUCCESS', {
        transferId: transfer.id_transferencia,
        transactionId: transfer.transaction_id,
        monto: transferData.monto
      });
      res.status(201).json({
        success: true,
        message: 'Transferencia registrada',
        data: transfer
      });
    }
  } catch (error) {
    logger.transactionFailed('createTransfer', error, {
      ipOrigen: req.ip || req.connection.remoteAddress || 'DESCONOCIDO',
      nombreUsuario: req.user?.nombre || 'DESCONOCIDO',
      endpoint: '/transferencias/crear'
    });
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
    
    logger.info('Validando transferencia', { ipOrigen, nombreUsuario });
    
    const transferData = {
      ...req.body,
      ipOrigen,
      nombreUsuario
    };
    
    const result = await Transfer.validateIncoming(transferData);
    
    logger.transferencia('validateTransfer', result.status, {
      razon: result.reason,
      ipOrigen
    });
    
    res.status(result.status === 'APROBADO' ? 200 : 200).json(result);
  } catch (error) {
    logger.transactionFailed('validateTransfer', error, {
      ipOrigen: req.ip || req.connection.remoteAddress || 'DESCONOCIDO'
    });
    res.status(500).json({
      status: 'RECHAZADO',
      reason: error.message
    });
  }
};

exports.validateDestinationAccount = async (req, res) => {
  try {
    logger.info('Validando cuenta destino', { numeroCuenta: req.body.numero_cuenta });
    const result = await Transfer.validateDestinationAccount(req.body);
    logger.transferencia('validateDestinationAccount', 'SUCCESS', result);
    res.json(result);
  } catch (error) {
    logger.transactionFailed('validateDestinationAccount', error, {
      numeroCuenta: req.body?.numero_cuenta
    });
    res.status(500).json({
      success: false,
      message: 'Error al validar cuenta destino',
      error: error.message
    });
  }
};

exports.getCatalogs = async (req, res) => {
  try {
    logger.info('Obteniendo catálogos de transferencias');
    const catalogs = await Transfer.getCatalogs();
    logger.info('Catálogos obtenidos exitosamente');
    res.json({
      success: true,
      data: catalogs
    });
  } catch (error) {
    logger.error('Error al obtener catálogos', error, { endpoint: '/transferencias/catalogs' });
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
      logger.warn('Validación de cuenta sin parámetros requeridos', {
        numeroCuenta: !!numeroCuenta,
        codigoSwift: !!codigoSwift
      });
      return res.status(400).json({
        success: false,
        message: 'Número de cuenta y código SWIFT son requeridos'
      });
    }

    logger.info('Validando cuenta en banco externo', { numeroCuenta, codigoSwift });
    const result = await Transfer.validateAccountExternal(numeroCuenta, codigoSwift);

    logger.info('Validación de cuenta completada', {
      existe: result.existe,
      codigoSwift
    });

    res.json({
      success: result.existe,
      data: result
    });
  } catch (error) {
    logger.transactionFailed('validateAccountAtBank', error, {
      numeroCuenta: req.body?.numeroCuenta,
      codigoSwift: req.body?.codigoSwift
    });
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
    
    logger.info('Recibiendo transferencia interbancaria', {
      ipOrigen,
      nombreUsuario,
      monto: req.body.monto,
      swiftOrigen: req.body.swiftOrigen
    });
    
    const transferData = {
      ...req.body,
      ipOrigen,
      nombreUsuario
    };
    
    const result = await Transfer.validateIncoming(transferData);
    
    if (result.status === 'APROBADO') {
      logger.transferencia('receiveIncomingTransfer', 'APROBADO', {
        transactionId: result.TransactionID,
        monto: req.body.monto,
        ipOrigen,
        swiftOrigen: req.body.swiftOrigen
      });
      res.status(200).json({
        success: true,
        status: 'APROBADO',
        TransactionID: result.TransactionID,
        message: 'Transferencia interbancaria recibida y aprobada exitosamente'
      });
    } else {
      logger.transferencia('receiveIncomingTransfer', 'RECHAZADO', {
        razon: result.reason,
        ipOrigen,
        swiftOrigen: req.body.swiftOrigen,
        monto: req.body.monto
      });
      res.status(400).json({
        success: false,
        status: 'RECHAZADO',
        message: result.reason
      });
    }
  } catch (error) {
    logger.transactionFailed('receiveIncomingTransfer', error, {
      ipOrigen: req.ip || req.connection.remoteAddress || 'DESCONOCIDO',
      swiftOrigen: req.body?.swiftOrigen,
      monto: req.body?.monto,
      endpoint: '/transferencias/recibir'
    });
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
    const ipOrigen = req.ip || req.connection.remoteAddress || 'DESCONOCIDO';
    
    logger.info('Recibiendo notificación de transferencia', {
      transactionId: transaction_id,
      estado,
      ipOrigen
    });
    
    if (!transaction_id || !estado) {
      logger.warn('Notificación incompleta recibida', {
        transactionId: !!transaction_id,
        estado: !!estado,
        ipOrigen
      });
      return res.status(400).json({
        success: false,
        message: 'transaction_id y estado son requeridos'
      });
    }

    const result = await Transfer.processNotification(transaction_id, estado, mensaje);
    
    logger.transferencia('receiveNotification', result.success ? 'SUCCESS' : 'FAILED', {
      transactionId: transaction_id,
      estado,
      message: result.message
    });
    
    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    logger.transactionFailed('receiveNotification', error, {
      transactionId: req.body?.transaction_id,
      estado: req.body?.estado,
      ipOrigen: req.ip || req.connection.remoteAddress || 'DESCONOCIDO'
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
