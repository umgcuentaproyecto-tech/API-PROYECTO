const Account = require('../models/cuentaModel');
const Client = require('../models/clienteModel');
const AuditService = require('../utils/auditService');

exports.getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.findAll();
    res.json({
      success: true,
      data: accounts,
      count: accounts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuentas',
      error: error.message
    });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    const account = await Account.findById(id);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuenta',
      error: error.message
    });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const { id_cliente, tipo_cuenta, moneda, swift_banco } = req.body;

    if (!id_cliente || !swift_banco) {
      return res.status(400).json({
        success: false,
        message: 'Cliente y banco son requeridos'
      });
    }

    const client = await Client.findById(id_cliente);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const account = await Account.create({
      id_cliente,
      tipo_cuenta: tipo_cuenta || 'MONETARIA',
      moneda: moneda || 'GTQ',
      swift_banco,
      saldo: 0.00
    });

    // Auditoría
    await AuditService.crear('cuentas', account.id_cuenta, {
      numero_cuenta: account.numero_cuenta,
      id_cliente: account.id_cliente,
      tipo_cuenta: account.tipo_cuenta,
      moneda: account.moneda,
      swift_banco: account.swift_banco
    }, req.user, req);

    res.status(201).json({
      success: true,
      message: 'Cuenta aperturada exitosamente',
      data: account
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al aperturar cuenta'
    });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo_cuenta, estado } = req.body;

    const existingAccount = await Account.findById(id);
    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    const updatedAccount = await Account.update(id, {
      tipo_cuenta: tipo_cuenta || existingAccount.tipo_cuenta,
      estado: estado || existingAccount.estado
    });

    // Auditoría
    await AuditService.actualizar('cuentas', id, {
      numero_cuenta: updatedAccount.numero_cuenta,
      estado: updatedAccount.estado,
      tipo_cuenta: updatedAccount.tipo_cuenta
    }, req.user, req);

    res.json({
      success: true,
      message: 'Cuenta actualizada exitosamente',
      data: updatedAccount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar cuenta'
    });
  }
};

exports.getAccountsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const accounts = await Account.getAccountsByClient(clientId);

    res.json({
      success: true,
      client_name: `${client.nombres} ${client.apellidos}`,
      data: accounts,
      count: accounts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cuentas del cliente',
      error: error.message
    });
  }
};

exports.closeAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    const closedAccount = await Account.closeAccount(id);

    res.json({
      success: true,
      message: 'Cuenta cerrada exitosamente',
      data: closedAccount
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al cerrar cuenta'
    });
  }
};

exports.getAccountBalance = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    const account = await Account.findByAccountNumber(accountNumber);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    res.json({
      success: true,
      numero_cuenta: account.numero_cuenta,
      saldo: account.saldo,
      moneda: account.moneda,
      estado: account.estado
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener saldo',
      error: error.message
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await Account.findById(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    // Eliminar la cuenta
    await Account.delete(id);

    // Auditoría
    await AuditService.eliminar('cuentas', id, {
      numero_cuenta: account.numero_cuenta,
      cliente: account.nombre_cliente,
      saldo: account.saldo,
      estado: account.estado
    }, req.user, req);

    res.json({
      success: true,
      message: 'Cuenta eliminada completamente'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar cuenta'
    });
  }
};
