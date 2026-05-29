const TIME_ZONE = 'America/Guatemala';

function getParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('es-GT', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function fechaHoraGuatemala(date = new Date()) {
  const parts = getParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function fechaCompactaGuatemala(date = new Date()) {
  const parts = getParts(date);
  return `${parts.year.slice(2)}${parts.month}${parts.day}`;
}

module.exports = {
  TIME_ZONE,
  fechaHoraGuatemala,
  fechaCompactaGuatemala
};
