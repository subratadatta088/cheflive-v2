function log(level, msg, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta && typeof meta === 'object' ? meta : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else console.log(line)
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
}

