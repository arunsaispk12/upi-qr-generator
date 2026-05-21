function buildWiFiString({ ssid, password, security = 'WPA', hidden = false }) {
  if (!ssid) throw new Error('SSID is required');
  const esc = s => (s || '').replace(/([\\;,"':])/, '\\$1');
  return `WIFI:T:${security};S:${esc(ssid)};P:${esc(password)};H:${hidden};;`;
}

module.exports = { buildWiFiString };
