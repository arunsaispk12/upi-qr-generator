const { buildUPIString, validateUPIId } = require('./upi');
const { buildWiFiString }               = require('./wifi');

const QR_TYPES = {
  url: {
    label: 'Website',
    defaultColor: '#1a73e8',
    subtitle: 'Scan to Visit',
    centreLabelText: 'URL',
    buildQrString({ url }) {
      if (!url || !url.trim()) throw new Error('URL is required');
      return url.trim();
    },
    validate({ url }) {
      if (!url || !url.trim()) return 'URL is required';
      try {
        const parsed = new URL(url.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) return 'Invalid URL — include https://';
        return null;
      } catch { return 'Invalid URL — include https://'; }
    },
  },

  whatsapp: {
    label: 'WhatsApp',
    defaultColor: '#25D366',
    subtitle: 'Scan to Chat',
    centreLabelText: 'WA',
    buildQrString({ waPhone, waMessage }) {
      if (!waPhone) throw new Error('Phone number is required');
      const phone = waPhone.replace(/\D/g, '');
      let u = `https://wa.me/${phone}`;
      if (waMessage && waMessage.trim()) u += `?text=${encodeURIComponent(waMessage.trim())}`;
      return u;
    },
    validate({ waPhone }) {
      if (!waPhone) return 'Phone number is required';
      const d = waPhone.replace(/\D/g, '');
      if (d.length < 7 || d.length > 15) return 'Phone must be 7-15 digits (include country code)';
      return null;
    },
  },

  instagram: {
    label: 'Instagram',
    defaultColor: '#E1306C',
    subtitle: 'Scan to Follow',
    centreLabelText: 'IG',
    buildQrString({ igUsername }) {
      if (!igUsername) throw new Error('Username is required');
      // Strip @, keep only valid IG handle chars so nothing leaks into the path/query.
      const handle = igUsername.replace(/^@/, '').trim().replace(/[^A-Za-z0-9._]/g, '');
      if (!handle) throw new Error('Username is required');
      return `https://instagram.com/${handle}`;
    },
    validate({ igUsername }) {
      if (!igUsername || !igUsername.trim()) return 'Instagram username is required';
      if (!/^@?[A-Za-z0-9._]{1,30}$/.test(igUsername.trim()))
        return 'Invalid Instagram username (letters, numbers, . and _ only)';
      return null;
    },
  },

  google_review: {
    label: 'Google Review',
    defaultColor: '#4285F4',
    subtitle: 'Leave a Review',
    centreLabelText: 'G',
    buildQrString({ grPlaceId }) {
      if (!grPlaceId) throw new Error('Place ID is required');
      return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(grPlaceId.trim())}`;
    },
    validate({ grPlaceId }) {
      if (!grPlaceId || !grPlaceId.trim()) return 'Google Place ID is required';
      return null;
    },
  },

  upi: {
    label: 'UPI Payment',
    defaultColor: '#7c3aed',
    subtitle: 'Scan to Pay',
    centreLabelText: 'UPI',
    buildQrString({ upiId, payeeName, amount, note }) {
      return buildUPIString({ upiId, payeeName, amount, note });
    },
    validate({ upiId, payeeName }) {
      if (!upiId)     return 'UPI ID is required';
      if (!payeeName) return 'Payee name is required';
      if (!validateUPIId(upiId)) return 'Invalid UPI ID — use format name@provider';
      return null;
    },
  },

  wifi: {
    label: 'WiFi',
    defaultColor: '#0ea5e9',
    subtitle: 'Scan to Connect',
    centreLabelText: 'WiFi',
    buildQrString({ wifiSsid, wifiPassword, wifiSecurity, wifiHidden }) {
      return buildWiFiString({
        ssid: wifiSsid, password: wifiPassword,
        security: wifiSecurity || 'WPA', hidden: !!wifiHidden,
      });
    },
    validate({ wifiSsid }) {
      if (!wifiSsid) return 'Network name (SSID) is required';
      return null;
    },
  },
};

module.exports = { QR_TYPES };
