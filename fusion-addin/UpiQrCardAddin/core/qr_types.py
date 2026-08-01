"""QR string builders + mode registry.

Direct port of src/upi.js, src/wifi.js and src/qr-types.js from the web app —
same field names, same validation rules, same output strings — so a plaque
built here encodes identically to the one the web app would generate for the
same inputs. Keep this file in sync with those three if they change.
"""

import re
from urllib.parse import quote, urlsplit


def encode_uri_component(s):
    """Match JS encodeURIComponent's unreserved set exactly (quote() alone
    also leaves '/' unescaped, which encodeURIComponent does not)."""
    return quote(str(s), safe="!~*'()")


# ---------------------------------------------------------------------------
# upi.js
# ---------------------------------------------------------------------------

def build_upi_string(upi_id, payee_name, amount=None, note=None):
    if not upi_id:
        raise ValueError('upiId is required')
    if not payee_name:
        raise ValueError('payeeName is required')

    s = f"upi://pay?pa={encode_uri_component(upi_id)}&pn={encode_uri_component(payee_name)}&cu=INR"
    if amount:
        try:
            amt = float(amount)
        except (TypeError, ValueError):
            amt = 0
        if amt > 0:
            s += f"&am={amt:.2f}"
    if note and note.strip():
        s += f"&tn={encode_uri_component(note.strip())}"
    return s


def validate_upi_id(upi_id):
    return bool(re.match(r'^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$', upi_id or ''))


# ---------------------------------------------------------------------------
# wifi.js
# ---------------------------------------------------------------------------

def build_wifi_string(ssid, password=None, security='WPA', hidden=False):
    if not ssid:
        raise ValueError('SSID is required')
    auth = security if security in ('WPA', 'WEP', 'nopass') else 'WPA'
    t = 'nopass' if (auth == 'nopass' or not password) else auth

    def esc(s):
        return re.sub(r'([\\;,"\':])', r'\\\1', s or '')

    pw = '' if t == 'nopass' else esc(password)
    return f"WIFI:T:{t};S:{esc(ssid)};P:{pw};H:{'true' if hidden else 'false'};;"


# ---------------------------------------------------------------------------
# qr-types.js — one entry per mode: label, default color, centre label text,
# a build_qr_string(fields) -> str, and a validate(fields) -> str|None.
# `fields` is the same flat dict the command dialog collects.
# ---------------------------------------------------------------------------

def _build_url(fields):
    url = (fields.get('url') or '').strip()
    if not url:
        raise ValueError('URL is required')
    return url


def _validate_url(fields):
    url = (fields.get('url') or '').strip()
    if not url:
        return 'URL is required'
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.netloc:
        return 'Invalid URL — include https://'
    return None


def _build_whatsapp(fields):
    wa_phone = fields.get('waPhone')
    if not wa_phone:
        raise ValueError('Phone number is required')
    phone = re.sub(r'\D', '', wa_phone)
    u = f"https://wa.me/{phone}"
    wa_message = (fields.get('waMessage') or '').strip()
    if wa_message:
        u += f"?text={encode_uri_component(wa_message)}"
    return u


def _validate_whatsapp(fields):
    wa_phone = fields.get('waPhone')
    if not wa_phone:
        return 'Phone number is required'
    d = re.sub(r'\D', '', wa_phone)
    if len(d) < 7 or len(d) > 15:
        return 'Phone must be 7-15 digits (include country code)'
    return None


def _build_instagram(fields):
    ig_username = fields.get('igUsername')
    if not ig_username:
        raise ValueError('Username is required')
    handle = re.sub(r'^@', '', ig_username.strip())
    handle = re.sub(r'[^A-Za-z0-9._]', '', handle)
    if not handle:
        raise ValueError('Username is required')
    return f"https://instagram.com/{handle}"


def _validate_instagram(fields):
    ig_username = (fields.get('igUsername') or '').strip()
    if not ig_username:
        return 'Instagram username is required'
    if not re.match(r'^@?[A-Za-z0-9._]{1,30}$', ig_username):
        return 'Invalid Instagram username (letters, numbers, . and _ only)'
    return None


def _build_google_review(fields):
    gr_place_id = fields.get('grPlaceId')
    if not gr_place_id:
        raise ValueError('Place ID is required')
    return f"https://search.google.com/local/writereview?placeid={encode_uri_component(gr_place_id.strip())}"


def _validate_google_review(fields):
    gr_place_id = (fields.get('grPlaceId') or '').strip()
    if not gr_place_id:
        return 'Google Place ID is required'
    return None


def _build_upi(fields):
    return build_upi_string(
        fields.get('upiId'), fields.get('payeeName'),
        fields.get('amount'), fields.get('note'),
    )


def _validate_upi(fields):
    upi_id = fields.get('upiId')
    payee_name = fields.get('payeeName')
    if not upi_id:
        return 'UPI ID is required'
    if not payee_name:
        return 'Payee name is required'
    if not validate_upi_id(upi_id):
        return 'Invalid UPI ID — use format name@provider'
    return None


def _build_wifi(fields):
    return build_wifi_string(
        fields.get('wifiSsid'), fields.get('wifiPassword'),
        fields.get('wifiSecurity') or 'WPA', bool(fields.get('wifiHidden')),
    )


def _validate_wifi(fields):
    if not fields.get('wifiSsid'):
        return 'Network name (SSID) is required'
    return None


QR_TYPES = {
    'url': {
        'label': 'Website', 'defaultColor': '#1a73e8', 'subtitle': 'Scan to Visit',
        'centreLabelText': 'URL', 'build_qr_string': _build_url, 'validate': _validate_url,
    },
    'whatsapp': {
        'label': 'WhatsApp', 'defaultColor': '#25D366', 'subtitle': 'Scan to Chat',
        'centreLabelText': 'WA', 'build_qr_string': _build_whatsapp, 'validate': _validate_whatsapp,
    },
    'instagram': {
        'label': 'Instagram', 'defaultColor': '#E1306C', 'subtitle': 'Scan to Follow',
        'centreLabelText': 'IG', 'build_qr_string': _build_instagram, 'validate': _validate_instagram,
    },
    'google_review': {
        'label': 'Google Review', 'defaultColor': '#4285F4', 'subtitle': 'Leave a Review',
        'centreLabelText': 'G', 'build_qr_string': _build_google_review, 'validate': _validate_google_review,
    },
    'upi': {
        'label': 'UPI Payment', 'defaultColor': '#7c3aed', 'subtitle': 'Scan to Pay',
        'centreLabelText': 'UPI', 'build_qr_string': _build_upi, 'validate': _validate_upi,
    },
    'wifi': {
        'label': 'WiFi', 'defaultColor': '#0ea5e9', 'subtitle': 'Scan to Connect',
        'centreLabelText': 'WiFi', 'build_qr_string': _build_wifi, 'validate': _validate_wifi,
    },
}
