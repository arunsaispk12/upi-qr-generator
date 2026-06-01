function buildWiFiString({ ssid, password, security = 'WPA', hidden = false }) {
  if (!ssid) throw new Error('SSID is required');
  // Only the three WPA spec values are valid; anything else (incl. injection) → nopass.
  const auth = ['WPA', 'WEP', 'nopass'].includes(security) ? security : 'WPA';
  const t = (auth === 'nopass' || !password) ? 'nopass' : auth;
  const esc = s => (s || '').replace(/([\\;,"':])/g, '\\$1');
  const pass = t === 'nopass' ? '' : esc(password);
  return `WIFI:T:${t};S:${esc(ssid)};P:${pass};H:${!!hidden};;`;
}

module.exports = { buildWiFiString };
