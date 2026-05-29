const Finance = require('../models/finanzasModel');
const { fechaHoraGuatemala } = require('../utils/fechaGuatemala');

function parseRangeParameters(query) {
  const today = new Date();
  const endDate = query.hasta ? new Date(query.hasta) : today;
  const startDate = query.desde ? new Date(query.desde) : new Date(new Date(endDate).setDate(endDate.getDate() - 29));

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  return {
    startDate: fechaHoraGuatemala(start),
    endDate: fechaHoraGuatemala(end)
  };
}

function parseDashboardRange(periodo) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  const currentStart = new Date(today);
  switch (periodo) {
    case 'ANUAL':
      currentStart.setFullYear(today.getFullYear() - 1);
      break;
    case 'ULTIMOS_30_DIAS':
      currentStart.setDate(today.getDate() - 29);
      break;
    case 'ESTE_MES':
      currentStart.setDate(1);
      break;
    default:
      currentStart.setDate(today.getDate() - 29);
  }
  currentStart.setHours(0, 0, 0, 0);

  const previousStart = new Date(currentStart);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousStart.setDate(previousStart.getDate() - (endDate.getDate() - currentStart.getDate() + 1));
  previousStart.setHours(0, 0, 0, 0);
  previousEnd.setHours(23, 59, 59, 999);

  return {
    currentStart: fechaHoraGuatemala(currentStart),
    currentEnd: fechaHoraGuatemala(endDate),
    previousStart: fechaHoraGuatemala(previousStart),
    previousEnd: fechaHoraGuatemala(previousEnd)
  };
}

exports.getBalanceReport = async (req, res) => {
  try {
    const data = await Finance.getAccountsSummary();
    const totalSaldo = data.reduce((sum, item) => sum + parseFloat(item.saldo || 0), 0);
    return res.status(200).json({
      success: true,
      count: data.length,
      total_saldo: totalSaldo,
      data
    });
  } catch (error) {
    console.error('Error al obtener reportes de saldos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener reportes de saldos',
      error: error.message
    });
  }
};

exports.getBalanceByType = async (req, res) => {
  try {
    const data = await Finance.getBalanceByType();
    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error al obtener saldos por tipo de cuenta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener saldos por tipo de cuenta',
      error: error.message
    });
  }
};

exports.getBalanceHistory = async (req, res) => {
  try {
    const { startDate, endDate } = parseRangeParameters(req.query);
    const data = await Finance.getBalanceHistory(startDate, endDate);
    return res.status(200).json({
      success: true,
      desde: startDate,
      hasta: endDate,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error al obtener historico de saldos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener historico de saldos',
      error: error.message
    });
  }
};

exports.getDailyTransferSummary = async (req, res) => {
  try {
    const { startDate, endDate } = parseRangeParameters(req.query);
    const data = await Finance.getDailyTransferSummary(startDate, endDate);
    return res.status(200).json({
      success: true,
      desde: startDate,
      hasta: endDate,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error al obtener resumen diario de transferencias:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener resumen diario de transferencias',
      error: error.message
    });
  }
};

exports.getVolumeByBank = async (req, res) => {
  try {
    const { startDate, endDate } = parseRangeParameters(req.query);
    const data = await Finance.getVolumeByBank(startDate, endDate);
    return res.status(200).json({
      success: true,
      desde: startDate,
      hasta: endDate,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error al obtener volumen por banco:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener volumen por banco',
      error: error.message
    });
  }
};

exports.getTotalsMoved = async (req, res) => {
  try {
    const { startDate, endDate } = parseRangeParameters(req.query);
    const totals = await Finance.getTotalsMoved(startDate, endDate);
    return res.status(200).json({
      success: true,
      desde: startDate,
      hasta: endDate,
      data: totals
    });
  } catch (error) {
    console.error('Error al obtener totales movidos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener totales movidos',
      error: error.message
    });
  }
};

exports.getAccountStatement = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({
      success: false,
      message: 'ID de cuenta requerido'
    });
  }

  try {
    const { startDate, endDate } = parseRangeParameters(req.query);
    const statement = await Finance.getAccountStatement(accountId, startDate, endDate, 500);

    if (!statement) {
      return res.status(404).json({
        success: false,
        message: 'Cuenta no encontrada'
      });
    }

    return res.status(200).json({
      success: true,
      desde: startDate,
      hasta: endDate,
      data: statement
    });
  } catch (error) {
    console.error('Error al obtener estado de cuenta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estado de cuenta',
      error: error.message
    });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const thresholdLow = Number(req.query.limiteBajo || 1000);
    const thresholdTransfer = Number(req.query.limiteTransferencia || 5000);
    const thresholdSuspicious = Number(req.query.limiteSospechoso || 5000);

    const data = await Finance.getAlerts(thresholdLow, thresholdTransfer, thresholdSuspicious);
    return res.status(200).json({
      success: true,
      thresholds: {
        limiteBajo: thresholdLow,
        limiteTransferencia: thresholdTransfer,
        limiteSospechoso: thresholdSuspicious
      },
      data
    });
  } catch (error) {
    console.error('Error al obtener alertas financieras:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener alertas financieras',
      error: error.message
    });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const periodo = req.query.periodo || 'ULTIMOS_30_DIAS';
    const { currentStart, currentEnd, previousStart, previousEnd } = parseDashboardRange(periodo);
    const data = await Finance.getDashboardSummary(currentStart, currentEnd, previousStart, previousEnd);

    return res.status(200).json({
      success: true,
      periodo,
      range: {
        actual: { desde: currentStart, hasta: currentEnd },
        anterior: { desde: previousStart, hasta: previousEnd }
      },
      data
    });
  } catch (error) {
    console.error('Error al obtener dashboard financiero:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener dashboard financiero',
      error: error.message
    });
  }
};
