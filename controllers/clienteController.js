const Client = require('../models/clienteModel');

exports.getAllClients = async (req, res) => {
  try {
    const clients = await Client.findAll();
    res.json({
      success: true,
      data: clients,
      count: clients.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener clientes',
      error: error.message
    });
  }
};

exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.json({
      success: true,
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente',
      error: error.message
    });
  }
};

exports.createClient = async (req, res) => {
  try {
    const { nombres, apellidos, dpi, nit, telefono, email, direccion } = req.body;

    if (!nombres || !apellidos || !dpi) {
      return res.status(400).json({
        success: false,
        message: 'Nombres, apellidos y DPI son requeridos'
      });
    }

    // Validar DPI: solo números, entre 13 y 15 dígitos
    const dpiClean = String(dpi).replace(/[-\s]/g, '');
    if (!/^\d{13,15}$/.test(dpiClean)) {
      return res.status(400).json({
        success: false,
        message: 'El DPI debe contener entre 13 y 15 dígitos'
      });
    }

    const client = await Client.create({
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      dpi: dpiClean,
      nit: nit?.trim() || null,
      telefono: telefono?.trim() || null,
      email: email?.trim() || null,
      direccion: direccion?.trim() || null,
      estado: 'ACTIVO'
    });

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: client
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear cliente'
    });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombres, apellidos, dpi, nit, telefono, email, direccion, estado } = req.body;

    const existingClient = await Client.findById(id);
    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Validar DPI si se proporciona
    if (dpi) {
      const dpiClean = String(dpi).replace(/[-\s]/g, '');
      if (!/^\d{13,15}$/.test(dpiClean)) {
        return res.status(400).json({
          success: false,
          message: 'El DPI debe contener entre 13 y 15 dígitos'
        });
      }
    }

    const updatedClient = await Client.update(id, {
      nombres: nombres?.trim() || existingClient.nombres,
      apellidos: apellidos?.trim() || existingClient.apellidos,
      dpi: dpi ? String(dpi).replace(/[-\s]/g, '') : existingClient.dpi,
      nit: nit?.trim() || null,
      telefono: telefono?.trim() || null,
      email: email?.trim() || null,
      direccion: direccion?.trim() || null,
      estado: estado || existingClient.estado
    });

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: updatedClient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar cliente'
    });
  }
};

exports.getClientAccounts = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const accounts = await Client.getClientAccounts(id);

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

exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const deactivatedClient = await Client.deactivate(id);

    res.json({
      success: true,
      message: 'Cliente y todas sus cuentas desactivados exitosamente',
      data: deactivatedClient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Error al desactivar cliente'
    });
  }
};
