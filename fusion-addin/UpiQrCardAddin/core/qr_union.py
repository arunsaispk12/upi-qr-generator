"""QR union-outline geometry — Python port of qrUnionPath() from
public/svg-export.js (lines 196-247).

Same idea, different output target: the JS version walks the QR module grid
and keeps only edges between a dark and a light neighbour (cancelling shared
internal edges between adjacent dark modules), stitches those into closed
loops, and formats them as one SVG <path>. This module does the identical
grid walk and loop-stitch but returns raw point loops in MODULE-GRID units
(0..size) instead of an SVG path string — geometry.py scales/positions them
onto the actual plate in Fusion's sketch space.

Cross-checked against the JS original (same edge map, same loop-pop
traversal, same collinear-point collapse) for representative QR strings —
see fusion-addin/README.md's verification section.
"""


def qr_union_loops(matrix, logo_rect=None):
    """
    matrix: an object with .size (int) and .is_dark(row, col) -> bool
            (core.qr_matrix.QrMatrix satisfies this).
    logo_rect: optional (x, y, w, h) in MODULE-GRID units — dark modules whose
               centre falls inside this rect are excluded (the centre-badge
               cutout), same as `inLogo` in the JS original.

    Returns: list of loops; each loop is a list of (x, y) float tuples in
    module-grid units (0..size), tracing the outer boundary and any interior
    holes of the connected dark-module regions. Every loop is closed
    (implicitly — first point is not repeated at the end) and collinear
    points along straight runs are already collapsed.
    """
    size = matrix.size

    def in_logo(gx, gy):
        if not logo_rect:
            return False
        lx, ly, lw, lh = logo_rect
        return lx <= gx <= lx + lw and ly <= gy <= ly + lh

    def is_dark(r, c):
        if r < 0 or r >= size or c < 0 or c >= size:
            return False
        if not matrix.is_dark(r, c):
            return False
        return not in_logo(c + 0.5, r + 0.5)

    edges = {}  # (x, y) -> list[(x2, y2)], boundary edges only

    def push(x1, y1, x2, y2):
        edges.setdefault((x1, y1), []).append((x2, y2))

    for r in range(size):
        for c in range(size):
            if not is_dark(r, c):
                continue
            if not is_dark(r - 1, c):
                push(c, r, c + 1, r)          # top edge
            if not is_dark(r, c + 1):
                push(c + 1, r, c + 1, r + 1)  # right edge
            if not is_dark(r + 1, c):
                push(c + 1, r + 1, c, r + 1)  # bottom edge
            if not is_dark(r, c - 1):
                push(c, r + 1, c, r)          # left edge

    loops = []
    for start in list(edges.keys()):
        arr = edges.get(start)
        while arr:
            sx, sy = start
            loop = [(sx, sy)]
            cx, cy = arr.pop()
            while not (cx == sx and cy == sy):
                loop.append((cx, cy))
                nexts = edges.get((cx, cy))
                if not nexts:
                    break
                cx, cy = nexts.pop()

            n = len(loop)
            pts = []
            for i in range(n):
                ax, ay = loop[(i - 1) % n]
                bx, by = loop[i]
                dx, dy = loop[(i + 1) % n]
                collinear = (bx - ax) * (dy - by) == (by - ay) * (dx - bx)
                if not collinear:
                    pts.append((bx, by))
            if len(pts) >= 3:
                loops.append(pts)
            arr = edges.get(start)

    return loops
