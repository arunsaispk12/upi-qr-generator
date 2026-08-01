"""QR module matrix — Python equivalent of src/qr-matrix.js.

Fusion's bundled Python can't easily `pip install`, so a pure-Python `qrcode`
(MIT, no PIL/pypng needed for `get_matrix()`) is vendored under ../lib and put
on sys.path here. Verified byte-for-byte identical to src/qr-matrix.js's
getQrMatrix() for representative strings (same error-correction level, same
"no quiet zone" convention — border=0, see get_matrix()'s own docstring).
"""

import os
import sys
from collections import namedtuple

_LIB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib')
if _LIB_DIR not in sys.path:
    sys.path.insert(0, _LIB_DIR)

import qrcode  # noqa: E402  (path must be set up first)
from qrcode.constants import ERROR_CORRECT_H  # noqa: E402

QrMatrix = namedtuple('QrMatrix', ['size', 'is_dark'])


def get_qr_matrix(qr_string):
    """Build the QR module matrix for a string at error-correction level H.

    Returns a QrMatrix(size, is_dark) where is_dark(row, col) -> bool, True
    for a dark module. No quiet zone — same convention as qr-matrix.js.
    """
    if not qr_string:
        raise ValueError('get_qr_matrix: qr_string is required')

    qr = qrcode.QRCode(border=0, error_correction=ERROR_CORRECT_H)
    qr.add_data(qr_string)
    qr.make(fit=True)
    grid = qr.get_matrix()  # list[list[bool]], border=0 → no quiet zone
    size = len(grid)

    def is_dark(row, col):
        if row < 0 or row >= size or col < 0 or col >= size:
            return False
        return bool(grid[row][col])

    return QrMatrix(size=size, is_dark=is_dark)
