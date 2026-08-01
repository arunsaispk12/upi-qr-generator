"""Fusion solid-body construction for the QR plaque.

Mirrors buildSCADString()'s qr_plate() module (src/scad-builder.js:101-130):
a base plate (optionally rounded corners, optional keyring boss+hole), a
raised QR layer built from core.qr_union's closed loops, a raised centre
badge, and a raised centre label (text or a small logo). Native Fusion
features replace the OpenSCAD CSG operations (fillet instead of a rounded-
rect sketch, Join/Cut extrudes instead of union()/difference()).

All lengths in millimetres in the public functions; Fusion's internal unit
is centimetres, converted at the boundary via `_mm`.

API names/signatures here (setOneSideExtent+ThroughAllExtentDefinition for a
through-cut, createInput3 for sketch text, addConstantRadiusEdgeSet called
directly on the fillet input) were checked against Autodesk's current API
docs, not just recalled from memory — but none of this has been run inside
Fusion itself (not scriptable from this environment), so the in-app smoke
test in fusion-addin/README.md is still required before trusting it.
"""

import math
import re

import adsk.core
import adsk.fusion


def _parse_svg_size(path):
    """Best-effort (width, height) in the SVG's own native user units, read
    from its viewBox or width/height attributes — same idea as
    svg-export.js's nestSvg(), just enough to compute a fit-to-box scale for
    Sketch.importSVG (which takes a unitless scale multiplier, not a target
    size). Returns None if nothing usable is found, and importSVG falls back
    to filling the badge's own footprint 1:1."""
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            head = f.read(4096)
    except OSError:
        return None
    vb = re.search(r'viewBox\s*=\s*["\']([^"\']+)["\']', head)
    if vb:
        parts = vb.group(1).split()
        if len(parts) == 4:
            try:
                return float(parts[2]), float(parts[3])
            except ValueError:
                pass
    w = re.search(r'\bwidth\s*=\s*["\']?([\d.]+)', head)
    h = re.search(r'\bheight\s*=\s*["\']?([\d.]+)', head)
    if w and h:
        try:
            return float(w.group(1)), float(h.group(1))
        except ValueError:
            pass
    return None


def _mm(v):
    """Millimetres -> centimetres (Fusion's internal length unit)."""
    return v / 10.0


def _pt(x_mm, y_mm):
    return adsk.core.Point3D.create(_mm(x_mm), _mm(y_mm), 0)


def _offset_plane(component, base_plane, z_mm):
    """A construction plane parallel to base_plane, offset by z_mm — every
    sketch built on one of these shares the same X/Y origin and axes as the
    base rectangle sketch, so all the qr_x/qr_y placement math below is
    plain 2D arithmetic with no face-parameterization surprises."""
    planes = component.constructionPlanes
    inp = planes.createInput()
    inp.setByOffset(base_plane, adsk.core.ValueInput.createByReal(_mm(z_mm)))
    return planes.add(inp)


def _escape_text_expression(text):
    """SketchTexts.createInput3 takes an *expression* string where literal
    text must be single-quoted (e.g. "'Scan Me'"), so a user-supplied label
    containing a backslash or single quote must be escaped or it would break
    out of the string literal / be misread as expression syntax."""
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'") + "'"


# ---------------------------------------------------------------------------
# Loop nesting (dark/light classification) — see fusion-addin design notes.
# Fusion decomposes a sketch into one Profile per disjoint planar region, not
# by even-odd fill parity, so a profile at an ODD nesting depth (e.g. a QR
# finder pattern's white ring) must be excluded from the extrude, while EVEN
# depth profiles (the black ring outside it, the black dot inside it) must be
# kept.
#
# First attempt matched each Fusion Profile back to the original Python loop
# that produced it, via the entityToken of the SketchLine used to create its
# outer boundary. That's fragile here: this QR geometry constantly has many
# loops touching at shared grid-corner vertices (T/+ junctions wherever
# adjacent module-blobs meet), and Fusion routinely splits/merges coincident
# sketch curves at those junctions — so the SketchLine entity captured at
# creation time often isn't the one profile.profileLoops later reports, and
# the match silently fails for most/all profiles (keep.count == 0 — nothing
# gets extruded, leaving only the flat unextruded sketch lines visible,
# which is exactly the bug this replaced).
#
# Fix: don't try to preserve identity through Fusion's internal curve
# bookkeeping at all. For each Profile, read whatever curves it CURRENTLY has
# directly from Fusion (robust to any splitting/merging), build an interior
# probe point from them, and classify light/dark by testing that probe
# against the ORIGINAL loop list with plain point-in-polygon parity counting
# — the same ground-truth method already verified (zero mismatches) against
# the source QR matrix. No cross-referencing between Fusion and Python
# objects needed.
# ---------------------------------------------------------------------------

def _point_in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            x_at_y = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < x_at_y:
                inside = not inside
    return inside


def _bbox(loop):
    xs = [p[0] for p in loop]
    ys = [p[1] for p in loop]
    return min(xs), min(ys), max(xs), max(ys)


def _is_dark_point(x, y, loops, bboxes):
    """Parity of point-in-polygon containment across ALL loops — this is
    exactly the ground-truth reconstruction already verified cell-by-cell
    against the source QR matrix (see fusion-addin/README.md's Verification
    section), applied here to a single query point instead of every grid
    cell. The bbox pre-check skips the expensive ray-cast for loops that
    obviously can't contain the point."""
    depth = 0
    for (bx0, by0, bx1, by1), loop in zip(bboxes, loops):
        if not (bx0 <= x <= bx1 and by0 <= y <= by1):
            continue
        if _point_in_polygon(x, y, loop):
            depth += 1
    return depth % 2 == 1


def _profile_interior_probe(outer_loop, pitch_cm):
    """A point guaranteed strictly inside this Profile's own area, read live
    from Fusion's current sketch geometry (not from anything captured at
    creation time) — 0.5 grid-modules in from the midpoint of its first
    (axis-aligned) edge, on whichever side actually falls inside the loop.
    Safe even for a minimum-thickness (1-module) ring: it can't overshoot
    past the next nested boundary."""
    loop_pts = [(pc.sketchEntity.startSketchPoint.geometry.x,
                 pc.sketchEntity.startSketchPoint.geometry.y)
                for pc in outer_loop.profileCurves]
    if len(loop_pts) < 2:
        return None

    x1, y1 = loop_pts[0]
    x2, y2 = loop_pts[1]
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    half = pitch_cm * 0.5
    horizontal_edge = abs(y1 - y2) < abs(x1 - x2)
    candidates = [(mx, my + half), (mx, my - half)] if horizontal_edge else \
        [(mx + half, my), (mx - half, my)]
    for px, py in candidates:
        if _point_in_polygon(px, py, loop_pts):
            return px, py
    return None


def _draw_loops_and_extrude(component, sketch, loops, origin_x_mm, origin_y_mm,
                             pitch_mm, height_mm, operation):
    """Draw every loop (grid-unit points from core.qr_union) into `sketch`,
    positioned at (origin_x_mm + gx*pitch_mm, origin_y_mm + gy*pitch_mm), then
    extrude only the dark-region profiles by height_mm. Returns the resulting
    ExtrudeFeature, or None if there was nothing to extrude."""
    if not loops:
        return None

    lines = sketch.sketchCurves.sketchLines
    for loop in loops:
        pts = [_pt(origin_x_mm + gx * pitch_mm, origin_y_mm + gy * pitch_mm) for gx, gy in loop]
        n = len(pts)
        for i in range(n):
            lines.addByTwoPoints(pts[i], pts[(i + 1) % n])

    bboxes = [_bbox(loop) for loop in loops]
    origin_x_cm, origin_y_cm, pitch_cm = _mm(origin_x_mm), _mm(origin_y_mm), _mm(pitch_mm)

    keep = adsk.core.ObjectCollection.create()
    for profile in sketch.profiles:
        outer_loop = None
        for pl in profile.profileLoops:
            if pl.isOuter:
                outer_loop = pl
                break
        if outer_loop is None:
            continue

        probe = _profile_interior_probe(outer_loop, pitch_cm)
        if probe is None:
            continue
        px, py = probe
        gx = (px - origin_x_cm) / pitch_cm
        gy = (py - origin_y_cm) / pitch_cm
        if _is_dark_point(gx, gy, loops, bboxes):
            keep.add(profile)

    if keep.count == 0:
        return None

    extrudes = component.features.extrudeFeatures
    ext_input = extrudes.createInput(keep, operation)
    ext_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(_mm(height_mm)))
    return extrudes.add(ext_input)


def _cut_through_all(component, profile):
    extrudes = component.features.extrudeFeatures
    ext_input = extrudes.createInput(profile, adsk.fusion.FeatureOperations.CutFeatureOperation)
    extent_all = adsk.fusion.ThroughAllExtentDefinition.create()
    ext_input.setOneSideExtent(
        extent_all, adsk.fusion.ExtentDirections.PositiveExtentDirection,
        adsk.core.ValueInput.createByReal(0))
    return extrudes.add(ext_input)


# ---------------------------------------------------------------------------
# Rounded-rectangle sketch profiles + frame (border) construction.
#
# Corner winding verified standalone (CCW/positive area, correct clamping,
# correct ring-vs-hole point classification) before wiring into Fusion —
# see the plan notes. Two nested, non-touching rounded rects in ONE sketch
# is Fusion's reliable "washer" case (always exactly 2 disjoint profiles —
# the ring and the inner fill), unlike the QR grid's touching-vertex case or
# the keyring boss's overlapping-circle case, so picking the larger-area
# profile is safe here — no entityToken correlation needed.
# ---------------------------------------------------------------------------

def _add_rounded_rect_profile(sketch, x, y, w, h, r):
    """Draw a closed rounded-rectangle wire (4 lines + 4 arcs, or a plain
    rectangle if r<=0) into `sketch`, spanning (x,y) to (x+w,y+h)."""
    r = max(0, min(r, w / 2, h / 2))
    if r <= 0:
        sketch.sketchCurves.sketchLines.addTwoPointRectangle(_pt(x, y), _pt(x + w, y + h))
        return

    lines = sketch.sketchCurves.sketchLines
    arcs = sketch.sketchCurves.sketchArcs
    half_pi = math.pi / 2

    p_bottom_start, p_bottom_end = _pt(x + r, y), _pt(x + w - r, y)
    p_right_start, p_right_end = _pt(x + w, y + r), _pt(x + w, y + h - r)
    p_top_start, p_top_end = _pt(x + w - r, y + h), _pt(x + r, y + h)
    p_left_start, p_left_end = _pt(x, y + h - r), _pt(x, y + r)
    c_br, c_tr, c_tl, c_bl = _pt(x + w - r, y + r), _pt(x + w - r, y + h - r), \
        _pt(x + r, y + h - r), _pt(x + r, y + r)

    lines.addByTwoPoints(p_bottom_start, p_bottom_end)
    arcs.addByCenterStartSweep(c_br, p_bottom_end, half_pi)
    lines.addByTwoPoints(p_right_start, p_right_end)
    arcs.addByCenterStartSweep(c_tr, p_right_end, half_pi)
    lines.addByTwoPoints(p_top_start, p_top_end)
    arcs.addByCenterStartSweep(c_tl, p_top_end, half_pi)
    lines.addByTwoPoints(p_left_start, p_left_end)
    arcs.addByCenterStartSweep(c_bl, p_left_end, half_pi)


def _build_frame(component, plane, x, y, w, h, r, frame_width, height, operation):
    """A rectangular (optionally rounded) ring: outer boundary (x,y,w,h,r)
    minus an inner rect inset by frame_width on every side. Returns the
    ExtrudeFeature, or None if frame_width leaves no ring (inset consumes
    the whole shape)."""
    inner_w, inner_h = w - 2 * frame_width, h - 2 * frame_width
    if inner_w <= 0 or inner_h <= 0:
        return None

    sketch = component.sketches.add(plane)
    _add_rounded_rect_profile(sketch, x, y, w, h, r)
    _add_rounded_rect_profile(sketch, x + frame_width, y + frame_width, inner_w, inner_h,
                               max(0, r - frame_width))

    profiles = list(sketch.profiles)
    if not profiles:
        return None
    ring = max(profiles, key=lambda p: p.areaProperties().area)

    extrudes = component.features.extrudeFeatures
    ext_input = extrudes.createInput(ring, operation)
    ext_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(_mm(height)))
    return extrudes.add(ext_input)


# ---------------------------------------------------------------------------
# Plate layout — same formulas as scad-builder.js's qr_plate() module.
# ---------------------------------------------------------------------------

def _plate_layout(opts):
    base_length = opts['baseLength']
    base_width = opts['baseWidth']
    qr_size = opts['qrSize']
    # A brand-name header reserves a strip across the top of the card; the
    # QR field is centred in whatever space remains below it rather than in
    # the full plate (falls back to the original pure-centre layout when
    # there's no brand name, so this is fully backward compatible).
    header_h = opts.get('headerHeight', 0) if opts.get('brandName') else 0

    # The plate must stay big enough to fully contain the QR field PLUS its
    # optional frame — scad-builder.js's fixed "+8" margin (4mm each side)
    # only ever had to fit a centre badge, not a frame that can extend
    # further out than that at larger padding/width settings.
    qr_margin = 8
    if opts.get('showQrFrame'):
        qr_margin = max(qr_margin, 2 * (opts.get('qrFramePadding', 3) + opts.get('qrFrameWidth', 2)) + 4)

    actual_l = max(base_length, qr_size + qr_margin)
    actual_w = max(base_width, qr_size + qr_margin + header_h)
    qr_x = (actual_l - qr_size) / 2
    qr_y = (actual_w - header_h - qr_size) / 2
    header_y0 = actual_w - header_h  # bottom edge of the header strip

    tab_d = opts.get('tabDiameter', 12)
    pos = opts.get('keyringPosition', 0)
    if pos == 1:
        tab_x = actual_l + tab_d / 2 - tab_d * 0.25
    elif pos == 3:
        tab_x = -tab_d / 2 + tab_d * 0.25
    else:
        tab_x = actual_l / 2
    if pos == 0:
        tab_y = actual_w + tab_d / 2 - tab_d * 0.25
    elif pos == 2:
        tab_y = -tab_d / 2 + tab_d * 0.25
    else:
        tab_y = actual_w / 2

    return {
        'actual_l': actual_l, 'actual_w': actual_w,
        'qr_x': qr_x, 'qr_y': qr_y,
        'tab_x': tab_x, 'tab_y': tab_y,
        'header_h': header_h, 'header_y0': header_y0,
    }


def build_qr_plate(component, opts, qr_loops, qr_matrix_size):
    """Build the plaque into `component` (an empty Fusion Component).

    opts: same keys as scad-builder.js's buildSCADString() options, all
          lengths in millimetres — baseLength, baseWidth, baseThickness,
          qrSize, qrRaise, roundedCorners, cornerRadius, keyringHole,
          holeDiameter, tabDiameter, keyringPosition, centreLabel,
          centreLabelText, badgeWidth, badgeHeight, fontName (optional,
          default 'Arial'), logoSvgPath (optional, takes precedence over
          centreLabelText if set).
    qr_loops: output of core.qr_union.qr_union_loops(matrix, logo_rect) —
              loops in QR-local module-grid units (0..qr_matrix_size); this
              function scales them by qrSize/qr_matrix_size and positions
              them at the plate's qr_x/qr_y.
    qr_matrix_size: matrix.size from core.qr_matrix.get_qr_matrix() — the
              grid-unit -> mm scale factor is qrSize / qr_matrix_size.

    Returns the final adsk.fusion.BRepBody.
    """
    lay = _plate_layout(opts)
    base_thickness = opts['baseThickness']
    qr_raise = opts['qrRaise']
    badge_thickness = 0.4  # matches scad-builder.js:91 centre_badge_thickness
    text_height = 0.6      # matches scad-builder.js:92 centre_text_height

    root_plane = component.xYConstructionPlane
    extrudes = component.features.extrudeFeatures

    # 1. Base plate — plain rectangle, its own sketch, nothing else touching
    # or overlapping it. Kept deliberately isolated: an earlier version put
    # the rectangle and the (overlapping) tab-boss circle in the same sketch
    # and tried to select "every profile except the hole's", but overlapping
    # curves make Fusion's profile decomposition split into more disjoint
    # regions than expected (rect-only / overlap-only / circle-only), and
    # the exclusion logic could silently miss the boss — which is exactly
    # what caused the later keyring-hole cut to fail with "profile falls
    # outside the boundary of the selected body" (nothing there to cut,
    # because the boss was never actually part of the body). Simple single-
    # profile extrudes + explicit Join/Cut are robust regardless of overlap.
    base_sketch = component.sketches.add(root_plane)
    base_sketch.sketchCurves.sketchLines.addTwoPointRectangle(
        _pt(0, 0), _pt(lay['actual_l'], lay['actual_w']))
    base_input = extrudes.createInput(base_sketch.profiles.item(0),
                                       adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
    base_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(_mm(base_thickness)))
    base_extrude = extrudes.add(base_input)
    body = base_extrude.bodies.item(0)

    # 2. Keyring tab boss (Join) + through-hole (Cut) — each its own isolated
    # sketch/circle, unioned/cut via explicit boolean operations rather than
    # multi-profile selection.
    if opts.get('keyringHole'):
        tab_sketch = component.sketches.add(root_plane)
        tab_sketch.sketchCurves.sketchCircles.addByCenterRadius(
            _pt(lay['tab_x'], lay['tab_y']), _mm(opts.get('tabDiameter', 12) / 2))
        tab_input = extrudes.createInput(tab_sketch.profiles.item(0),
                                          adsk.fusion.FeatureOperations.JoinFeatureOperation)
        tab_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(_mm(base_thickness)))
        extrudes.add(tab_input)

        hole_sketch = component.sketches.add(root_plane)
        hole_sketch.sketchCurves.sketchCircles.addByCenterRadius(
            _pt(lay['tab_x'], lay['tab_y']), _mm(opts.get('holeDiameter', 5) / 2))
        _cut_through_all(component, hole_sketch.profiles.item(0))

    # 3. Rounded corners (fillet the 4 vertical edges of the base plate)
    if opts.get('roundedCorners'):
        radius = min(opts.get('cornerRadius', 4), lay['actual_l'] / 2, lay['actual_w'] / 2)
        if radius > 0:
            vertical_edges = adsk.core.ObjectCollection.create()
            for edge in body.edges:
                geom = edge.geometry
                if geom.curveType == adsk.core.Curve3DTypes.Line3DCurveType:
                    sp, ep = geom.startPoint, geom.endPoint
                    if abs(sp.x - ep.x) < 1e-9 and abs(sp.y - ep.y) < 1e-9:
                        vertical_edges.add(edge)
            if vertical_edges.count:
                fillets = component.features.filletFeatures
                fillet_input = fillets.createInput()
                fillet_input.addConstantRadiusEdgeSet(
                    vertical_edges, adsk.core.ValueInput.createByReal(_mm(radius)), True)
                fillets.add(fillet_input)

    # 3.5. Outer card border — a raised frame flush with the plate's own
    # (possibly rounded) edge, spanning the whole card including the header
    # strip if there is one. Off by default via opts['showOuterBorder'].
    top_plane = _offset_plane(component, root_plane, base_thickness)
    if opts.get('showOuterBorder'):
        corner_r = min(opts.get('cornerRadius', 4), lay['actual_l'] / 2, lay['actual_w'] / 2) \
            if opts.get('roundedCorners') else 0
        _build_frame(
            component, top_plane, 0, 0, lay['actual_l'], lay['actual_w'], corner_r,
            opts.get('borderWidth', 3), opts.get('borderHeight', 0.6),
            adsk.fusion.FeatureOperations.JoinFeatureOperation)

    # 4. Raised QR layer, on a plane offset by base_thickness
    if qr_loops:
        qr_sketch = component.sketches.add(top_plane)
        pitch = opts['qrSize'] / max(1, qr_matrix_size)
        _draw_loops_and_extrude(
            component, qr_sketch, qr_loops, lay['qr_x'], lay['qr_y'], pitch,
            qr_raise, adsk.fusion.FeatureOperations.JoinFeatureOperation)

    # 4.5. QR field frame — a border around just the QR pattern, same raised
    # height as the QR modules themselves so it reads as part of the display.
    if opts.get('showQrFrame'):
        pad = opts.get('qrFramePadding', 3)
        _build_frame(
            component, top_plane,
            lay['qr_x'] - pad, lay['qr_y'] - pad, opts['qrSize'] + 2 * pad, opts['qrSize'] + 2 * pad, 0,
            opts.get('qrFrameWidth', 2), qr_raise,
            adsk.fusion.FeatureOperations.JoinFeatureOperation)

    # 4.6. Brand-name header, raised text centred in the header strip
    # reserved by _plate_layout (only present when opts['brandName'] is set).
    if opts.get('brandName') and lay['header_h'] > 0:
        header_sketch = component.sketches.add(top_plane)
        header_text_size = lay['header_h'] * 0.4
        header_input = header_sketch.sketchTexts.createInput3(
            _escape_text_expression(opts['brandName']),
            adsk.core.ValueInput.createByReal(_mm(header_text_size)))
        header_input.setAsMultiLine(
            _pt(lay['actual_l'] * 0.05, lay['header_y0']),
            _pt(lay['actual_l'] * 0.95, lay['actual_w']),
            adsk.core.HorizontalAlignments.CenterHorizontalAlignment,
            adsk.core.VerticalAlignments.MiddleVerticalAlignment, 0)
        header_input.fontName = opts.get('fontName', 'Arial')
        header_sketch.sketchTexts.add(header_input)
        header_profiles = adsk.core.ObjectCollection.create()
        for p in header_sketch.profiles:
            header_profiles.add(p)
        if header_profiles.count:
            header_extrude_input = extrudes.createInput(
                header_profiles, adsk.fusion.FeatureOperations.JoinFeatureOperation)
            header_extrude_input.setDistanceExtent(
                False, adsk.core.ValueInput.createByReal(_mm(qr_raise)))
            extrudes.add(header_extrude_input)

    # 5. Centre badge — bottom flush on the base plate (fills the logo
    # cut-out solid), top qr_raise + badge_thickness above the base, so it
    # sits level with the raised QR layer's top instead of floating over an
    # unsupported air gap (a deliberate correction vs. the SCAD source, see
    # the plan's "Fusion geometry construction" section).
    if opts.get('centreLabel') and (opts.get('centreLabelText') or opts.get('logoSvgPath')):
        badge_w, badge_h = opts.get('badgeWidth', 30), opts.get('badgeHeight', 8)
        badge_x = lay['qr_x'] + (opts['qrSize'] - badge_w) / 2
        badge_y = lay['qr_y'] + (opts['qrSize'] - badge_h) / 2
        badge_sketch = component.sketches.add(top_plane)
        badge_sketch.sketchCurves.sketchLines.addTwoPointRectangle(
            _pt(badge_x, badge_y), _pt(badge_x + badge_w, badge_y + badge_h))
        badge_input = extrudes.createInput(badge_sketch.profiles.item(0),
                                            adsk.fusion.FeatureOperations.JoinFeatureOperation)
        badge_input.setDistanceExtent(
            False, adsk.core.ValueInput.createByReal(_mm(qr_raise + badge_thickness)))
        extrudes.add(badge_input)

        # 5.5. Badge frame — a thin border around the badge for visual
        # definition (the plain solid block alone reads as a blank patch).
        badge_frame_pad = 1.0
        _build_frame(
            component, top_plane,
            badge_x - badge_frame_pad, badge_y - badge_frame_pad,
            badge_w + 2 * badge_frame_pad, badge_h + 2 * badge_frame_pad, 0,
            1.0, qr_raise + badge_thickness, adsk.fusion.FeatureOperations.JoinFeatureOperation)

        # 6. Centre text or logo, on top of the badge
        label_plane = _offset_plane(component, root_plane, base_thickness + qr_raise + badge_thickness)
        top_sketch = component.sketches.add(label_plane)
        cx, cy = lay['qr_x'] + opts['qrSize'] / 2, lay['qr_y'] + opts['qrSize'] / 2

        if opts.get('logoSvgPath'):
            svg_w, svg_h = _parse_svg_size(opts['logoSvgPath']) or (badge_w, badge_h)
            # importSVG's scale multiplies the SVG's own native units into
            # sketch centimetres — fit-to-box (preserve aspect ratio) within
            # the badge footprint, same idea as svg-export.js's nestSvg().
            scale = min(_mm(badge_w) / svg_w, _mm(badge_h) / svg_h) if svg_w and svg_h else 1.0
            x_pos = _mm(cx) - (svg_w * scale) / 2
            y_pos = _mm(cy) - (svg_h * scale) / 2
            top_sketch.importSVG(opts['logoSvgPath'], x_pos, y_pos, scale)
        else:
            text_expr = _escape_text_expression(opts.get('centreLabelText', ''))
            text_size_mm = badge_h * 0.55
            text_input = top_sketch.sketchTexts.createInput3(
                text_expr, adsk.core.ValueInput.createByReal(_mm(text_size_mm)))
            text_input.setAsMultiLine(
                _pt(cx - badge_w / 2, cy - badge_h / 2), _pt(cx + badge_w / 2, cy + badge_h / 2),
                adsk.core.HorizontalAlignments.CenterHorizontalAlignment,
                adsk.core.VerticalAlignments.MiddleVerticalAlignment, 0)
            text_input.fontName = opts.get('fontName', 'Arial')
            top_sketch.sketchTexts.add(text_input)

        label_profiles = adsk.core.ObjectCollection.create()
        for p in top_sketch.profiles:
            label_profiles.add(p)
        if label_profiles.count:
            label_input = extrudes.createInput(label_profiles, adsk.fusion.FeatureOperations.JoinFeatureOperation)
            label_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(_mm(text_height)))
            extrudes.add(label_input)

    return body
