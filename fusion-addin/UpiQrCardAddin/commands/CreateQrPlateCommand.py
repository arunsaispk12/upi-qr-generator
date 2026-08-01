"""The 'UPI QR Card' command: a native Fusion dialog mirroring
scad-builder.js's parameter schema (see fusion-addin's plan notes), grouped
into tabs the way the Parametric Model Maker sample the user shared groups
its own params (Content / Plaque / QR / Centre) — using Fusion's own slider,
dropdown, checkbox and text command inputs instead of that tool's comment
syntax.
"""

import os
import sys
import traceback

import adsk.core
import adsk.fusion

_ADDIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ADDIN_DIR not in sys.path:
    sys.path.insert(0, _ADDIN_DIR)

from core.qr_types import QR_TYPES               # noqa: E402
from core.qr_matrix import get_qr_matrix         # noqa: E402
from core.qr_union import qr_union_loops         # noqa: E402
from core.geometry import build_qr_plate         # noqa: E402

CMD_ID = 'upiQrCardCreateCommand'
CMD_NAME = 'UPI QR Card'
CMD_DESCRIPTION = 'Create a parametric raised-QR plaque (base + raised QR + centre badge/label)'
WORKSPACE_ID = 'FusionSolidEnvironment'  # internal id survived the Model/Solid -> Design rebrand
PANEL_ID = 'SolidCreatePanel'

MODE_ORDER = ['upi', 'url', 'whatsapp', 'instagram', 'google_review', 'wifi']
FONT_CHOICES = ['Arial', 'Arial Black', 'Calibri', 'Verdana', 'Times New Roman']
KEYRING_POSITIONS = ['Top', 'Right', 'Bottom', 'Left']  # index == scad-builder.js keyring_position

_app = adsk.core.Application.get()
_ui = _app.userInterface
_handlers = []


def create_command_definition():
    cmd_def = _ui.commandDefinitions.itemById(CMD_ID)
    if cmd_def:
        return cmd_def
    cmd_def = _ui.commandDefinitions.addButtonDefinition(CMD_ID, CMD_NAME, CMD_DESCRIPTION)
    on_created = _CommandCreatedHandler()
    cmd_def.commandCreated.add(on_created)
    _handlers.append(on_created)
    return cmd_def


def _find_panel():
    # Workspace-scoped lookup first — panel ids are only guaranteed unique
    # within a workspace, and allToolbarPanels (searching every workspace at
    # once) has been unreliable across the Model/Solid -> Design rebrand.
    workspace = _ui.workspaces.itemById(WORKSPACE_ID)
    if workspace:
        panel = workspace.toolbarPanels.itemById(PANEL_ID)
        if panel:
            return panel
    return _ui.allToolbarPanels.itemById(PANEL_ID)


def add_to_panel(cmd_def):
    panel = _find_panel()
    if not panel:
        # Surface exactly what IS available so a wrong PANEL_ID/WORKSPACE_ID
        # guess is diagnosable instead of silently doing nothing.
        workspace = _ui.workspaces.itemById(WORKSPACE_ID)
        available = [p.id for p in workspace.toolbarPanels] if workspace else \
            [p.id for p in _ui.allToolbarPanels]
        _ui.messageBox(
            'UPI QR Card: could not find panel "{}" in workspace "{}".\n\n'
            'Available panels:\n{}'.format(PANEL_ID, WORKSPACE_ID, '\n'.join(available)))
        return
    if not panel.controls.itemById(CMD_ID):
        panel.controls.addCommand(cmd_def)


def remove_from_panel():
    panel = _find_panel()
    if panel:
        control = panel.controls.itemById(CMD_ID)
        if control:
            control.deleteMe()
    cmd_def = _ui.commandDefinitions.itemById(CMD_ID)
    if cmd_def:
        cmd_def.deleteMe()


# ---------------------------------------------------------------------------
# Dialog construction
# ---------------------------------------------------------------------------

def _build_content_tab(tab_children):
    mode_dd = tab_children.addDropDownCommandInput(
        'qrMode', 'QR Content Type', adsk.core.DropDownStyles.TextListDropDownStyle)
    for i, key in enumerate(MODE_ORDER):
        mode_dd.listItems.add(QR_TYPES[key]['label'], i == 0, '')

    groups = {}

    g = tab_children.addGroupCommandInput('grpUpi', 'UPI Payment')
    g.children.addStringValueInput('upiId', 'UPI ID (name@bank)', '')
    g.children.addStringValueInput('payeeName', 'Payee Name', '')
    g.children.addStringValueInput('amount', 'Amount (optional)', '')
    g.children.addStringValueInput('note', 'Note (optional)', '')
    groups['upi'] = g

    g = tab_children.addGroupCommandInput('grpUrl', 'Website')
    g.children.addStringValueInput('url', 'URL', 'https://')
    groups['url'] = g

    g = tab_children.addGroupCommandInput('grpWhatsapp', 'WhatsApp')
    g.children.addStringValueInput('waPhone', 'Phone (with country code)', '')
    g.children.addStringValueInput('waMessage', 'Pre-filled message (optional)', '')
    groups['whatsapp'] = g

    g = tab_children.addGroupCommandInput('grpInstagram', 'Instagram')
    g.children.addStringValueInput('igUsername', 'Username', '')
    groups['instagram'] = g

    g = tab_children.addGroupCommandInput('grpGoogleReview', 'Google Review')
    g.children.addStringValueInput('grPlaceId', 'Google Place ID', '')
    groups['google_review'] = g

    g = tab_children.addGroupCommandInput('grpWifi', 'WiFi')
    g.children.addStringValueInput('wifiSsid', 'Network name (SSID)', '')
    g.children.addStringValueInput('wifiPassword', 'Password', '')
    wifi_sec = g.children.addDropDownCommandInput(
        'wifiSecurity', 'Security', adsk.core.DropDownStyles.TextListDropDownStyle)
    for i, item in enumerate(['WPA', 'WEP', 'nopass']):
        wifi_sec.listItems.add(item, i == 0, '')
    g.children.addBoolValueInput('wifiHidden', 'Hidden network', True, '', False)
    groups['wifi'] = g

    _sync_mode_groups(groups, MODE_ORDER[0])
    return groups


def _sync_mode_groups(groups, selected_key):
    for key, g in groups.items():
        g.isVisible = (key == selected_key)


def _add_slider(children, input_id, name, min_cm, max_cm, default_cm):
    """addFloatSliderCommandInput(...).valueOne = default_cm was silently
    not sticking — Fusion rendered the slider at its minimum regardless
    (confirmed live: badgeWidth/badgeHeight both showed their minimum, not
    the assigned default). Setting expressionOne too (the string the UI
    itself displays/edits, in the slider's own 'mm' unitType) alongside
    valueOne (the authoritative cm value) makes the default actually show up
    correctly regardless of which one Fusion's widget reads from first."""
    slider = children.addFloatSliderCommandInput(input_id, name, 'mm', min_cm, max_cm)
    slider.valueOne = default_cm
    slider.expressionOne = f'{default_cm * 10:g} mm'
    return slider


def _build_plaque_tab(tab_children):
    _add_slider(tab_children, 'baseLength', 'Base length (mm)', 4, 20, 9)
    _add_slider(tab_children, 'baseWidth', 'Base width (mm)', 4, 20, 9)
    _add_slider(tab_children, 'baseThickness', 'Base thickness (mm)', 0.1, 1, 0.2)
    tab_children.addBoolValueInput('roundedCorners', 'Rounded corners', True, '', False)
    _add_slider(tab_children, 'cornerRadius', 'Corner radius (mm)', 0, 2, 0.4)
    tab_children.addBoolValueInput('keyringHole', 'Keyring hole', True, '', False)
    _add_slider(tab_children, 'holeDiameter', 'Hole diameter (mm)', 0.2, 0.8, 0.5)
    _add_slider(tab_children, 'tabDiameter', 'Tab diameter (mm)', 1.0, 3, 1.2)
    pos_dd = tab_children.addDropDownCommandInput(
        'keyringPosition', 'Keyring position', adsk.core.DropDownStyles.TextListDropDownStyle)
    for i, label in enumerate(KEYRING_POSITIONS):
        pos_dd.listItems.add(label, i == 0, '')


def _build_qr_tab(tab_children):
    _add_slider(tab_children, 'qrSize', 'QR size (mm)', 3, 15, 7)
    _add_slider(tab_children, 'qrRaise', 'QR raise height (mm)', 0.02, 0.3, 0.08)


def _build_centre_tab(tab_children):
    tab_children.addBoolValueInput('centreLabel', 'Show centre label', True, '', True)
    tab_children.addStringValueInput('centreLabelText', 'Centre label text', QR_TYPES[MODE_ORDER[0]]['centreLabelText'])
    _add_slider(tab_children, 'badgeWidth', 'Badge width (mm)', 1, 6, 3)
    _add_slider(tab_children, 'badgeHeight', 'Badge height (mm)', 0.4, 2, 0.8)
    font_dd = tab_children.addDropDownCommandInput(
        'fontName', 'Font', adsk.core.DropDownStyles.TextListDropDownStyle)
    for i, name in enumerate(FONT_CHOICES):
        font_dd.listItems.add(name, i == 0, '')

    # Custom logo (optional) — a vector SVG extruded on top of the badge
    # instead of the text label (geometry.py already prefers logoSvgPath
    # over centreLabelText when both are present). The classic Command
    # Inputs API has no native file-picker input, so this is a plain path
    # field plus a "Browse..." button that opens a real file dialog and
    # fills it in (handled in _InputChangedHandler).
    tab_children.addStringValueInput('logoSvgPath', 'Logo SVG file (optional)', '')
    tab_children.addBoolValueInput('browseLogoSvg', 'Browse for logo SVG...', False, '', False)


def _build_card_tab(tab_children):
    """Card-level framing/branding, layered on top of the Plaque/QR/Centre
    geometry: an optional raised header (brand name) above the QR, an outer
    card border, and a border around just the QR field — matching the full
    branded-card look (header + framed QR) rather than just a bare raised
    QR plaque."""
    tab_children.addStringValueInput('brandName', 'Brand name (optional header text)', '')
    _add_slider(tab_children, 'headerHeight', 'Header height (mm)', 0.8, 3.0, 1.5)

    tab_children.addBoolValueInput('showOuterBorder', 'Show outer card border', True, '', True)
    _add_slider(tab_children, 'borderWidth', 'Border width (mm)', 0.1, 0.8, 0.3)
    _add_slider(tab_children, 'borderHeight', 'Border raise height (mm)', 0.02, 0.2, 0.06)

    tab_children.addBoolValueInput('showQrFrame', 'Show QR field border', True, '', True)
    _add_slider(tab_children, 'qrFramePadding', 'QR frame padding (mm)', 0.1, 1.0, 0.3)
    _add_slider(tab_children, 'qrFrameWidth', 'QR frame width (mm)', 0.1, 0.6, 0.2)


class _CommandCreatedHandler(adsk.core.CommandCreatedEventHandler):
    def notify(self, args):
        try:
            cmd = args.command
            inputs = cmd.commandInputs

            content_tab = inputs.addTabCommandInput('tabContent', 'Content')
            plaque_tab = inputs.addTabCommandInput('tabPlaque', 'Plaque')
            qr_tab = inputs.addTabCommandInput('tabQr', 'QR')
            centre_tab = inputs.addTabCommandInput('tabCentre', 'Centre')
            card_tab = inputs.addTabCommandInput('tabCard', 'Card')

            mode_groups = _build_content_tab(content_tab.children)
            _build_plaque_tab(plaque_tab.children)
            _build_qr_tab(qr_tab.children)
            _build_centre_tab(centre_tab.children)
            _build_card_tab(card_tab.children)

            on_execute = _CommandExecuteHandler()
            cmd.execute.add(on_execute)
            _handlers.append(on_execute)

            on_input_changed = _InputChangedHandler(mode_groups)
            cmd.inputChanged.add(on_input_changed)
            _handlers.append(on_input_changed)

            on_validate = _ValidateInputsHandler()
            cmd.validateInputs.add(on_validate)
            _handlers.append(on_validate)
        except Exception:
            _ui.messageBox('UPI QR Card — command creation failed:\n{}'.format(traceback.format_exc()))


class _InputChangedHandler(adsk.core.InputChangedEventHandler):
    def __init__(self, mode_groups):
        super().__init__()
        self._mode_groups = mode_groups

    def notify(self, args):
        try:
            changed = args.input

            if changed.id == 'browseLogoSvg':
                file_dlg = _ui.createFileDialog()
                file_dlg.title = 'Choose a logo SVG'
                file_dlg.filter = 'SVG files (*.svg)|*.svg'
                if file_dlg.showOpen() == adsk.core.DialogResults.DialogOK:
                    args.inputs.itemById('logoSvgPath').value = file_dlg.filename
                return

            if changed.id != 'qrMode':
                return
            selected_key = MODE_ORDER[changed.selectedItem.index]
            _sync_mode_groups(self._mode_groups, selected_key)
            label_text_input = args.inputs.itemById('centreLabelText')
            if label_text_input and not label_text_input.value.strip():
                label_text_input.value = QR_TYPES[selected_key]['centreLabelText']
        except Exception:
            _ui.messageBox('UPI QR Card — input change failed:\n{}'.format(traceback.format_exc()))


class _ValidateInputsHandler(adsk.core.ValidateInputsEventHandler):
    def notify(self, args):
        try:
            fields, mode_key = _collect_fields(args.inputs)
            err = QR_TYPES[mode_key]['validate'](fields)
            if err is None:
                err = _validate_opts(_collect_opts(args.inputs))
            args.areInputsValid = err is None
        except Exception:
            # Fail permissive: a broken validator shouldn't brick the OK
            # button. Real errors still surface from _CommandExecuteHandler.
            args.areInputsValid = True


class _CommandExecuteHandler(adsk.core.CommandEventHandler):
    def notify(self, args):
        try:
            inputs = args.command.commandInputs
            fields, mode_key = _collect_fields(inputs)
            mode = QR_TYPES[mode_key]
            err = mode['validate'](fields)
            if err:
                _ui.messageBox(err)
                return

            opts = _collect_opts(inputs)
            opts_err = _validate_opts(opts)
            if opts_err:
                _ui.messageBox(opts_err)
                return

            qr_string = mode['build_qr_string'](fields)
            matrix = get_qr_matrix(qr_string)

            logo_rect = None
            if opts.get('centreLabel'):
                pitch = opts['qrSize'] / matrix.size
                bw, bh = opts['badgeWidth'] / pitch, opts['badgeHeight'] / pitch
                bx = (matrix.size - bw) / 2
                by = (matrix.size - bh) / 2
                logo_rect = (bx, by, bw, bh)

            loops = qr_union_loops(matrix, logo_rect)

            design = adsk.fusion.Design.cast(_app.activeProduct)
            # Build straight into the active component rather than creating a
            # new child one: a "Part" (as opposed to "Assembly"/"Hybrid")
            # design document only allows a single component and rejects
            # addNewComponent() with a RuntimeError, so this must work in both.
            component = design.activeComponent

            build_qr_plate(component, opts, loops, matrix.size)
        except Exception:
            _ui.messageBox('UPI QR Card — build failed:\n{}'.format(traceback.format_exc()))


# ---------------------------------------------------------------------------
# Reading dialog inputs back into plain dicts
# ---------------------------------------------------------------------------

def _slider_mm(input_id, inputs):
    """Slider .valueOne is always in cm (Fusion's database unit) regardless
    of the 'mm' unitType passed to addFloatSliderCommandInput — that only
    controls the displayed label. Named distinctly from geometry.py's _mm()
    (mm -> cm) since this converts the opposite direction (cm -> mm)."""
    return inputs.itemById(input_id).valueOne * 10


def _collect_fields(inputs):
    mode_key = MODE_ORDER[inputs.itemById('qrMode').selectedItem.index]
    fields = {
        'upiId': inputs.itemById('upiId').value,
        'payeeName': inputs.itemById('payeeName').value,
        'amount': inputs.itemById('amount').value,
        'note': inputs.itemById('note').value,
        'url': inputs.itemById('url').value,
        'waPhone': inputs.itemById('waPhone').value,
        'waMessage': inputs.itemById('waMessage').value,
        'igUsername': inputs.itemById('igUsername').value,
        'grPlaceId': inputs.itemById('grPlaceId').value,
        'wifiSsid': inputs.itemById('wifiSsid').value,
        'wifiPassword': inputs.itemById('wifiPassword').value,
        'wifiSecurity': ['WPA', 'WEP', 'nopass'][inputs.itemById('wifiSecurity').selectedItem.index],
        'wifiHidden': inputs.itemById('wifiHidden').value,
    }
    return fields, mode_key


def _validate_opts(opts):
    """Cross-field checks between independent Plaque-tab sliders that
    scad-builder.js's fixed defaults happen to satisfy, but nothing stops an
    invalid combination here (e.g. a hole bigger than the boss it's cut
    into, or a centre badge bigger than the QR field it should sit inside)."""
    if opts.get('keyringHole'):
        wall = (opts['tabDiameter'] - opts['holeDiameter']) / 2
        if wall < 1.5:
            return ('Keyring tab is too small for the hole — leave at least 1.5mm of material '
                     'around it (increase Tab diameter or decrease Hole diameter).')
    if opts.get('centreLabel'):
        margin = 0.9
        if opts['badgeWidth'] > opts['qrSize'] * margin or opts['badgeHeight'] > opts['qrSize'] * margin:
            return ('Centre badge is too large for the QR field — it must fit within the QR '
                     'size (increase QR size, or decrease Badge width/height).')
    return None


def _collect_opts(inputs):
    return {
        'baseLength': _slider_mm('baseLength', inputs),
        'baseWidth': _slider_mm('baseWidth', inputs),
        'baseThickness': _slider_mm('baseThickness', inputs),
        'qrSize': _slider_mm('qrSize', inputs),
        'qrRaise': _slider_mm('qrRaise', inputs),
        'roundedCorners': inputs.itemById('roundedCorners').value,
        'cornerRadius': _slider_mm('cornerRadius', inputs),
        'keyringHole': inputs.itemById('keyringHole').value,
        'holeDiameter': _slider_mm('holeDiameter', inputs),
        'tabDiameter': _slider_mm('tabDiameter', inputs),
        'keyringPosition': inputs.itemById('keyringPosition').selectedItem.index,
        'centreLabel': inputs.itemById('centreLabel').value,
        'centreLabelText': inputs.itemById('centreLabelText').value,
        'badgeWidth': _slider_mm('badgeWidth', inputs),
        'badgeHeight': _slider_mm('badgeHeight', inputs),
        'fontName': FONT_CHOICES[inputs.itemById('fontName').selectedItem.index],
        'logoSvgPath': inputs.itemById('logoSvgPath').value.strip() or None,
        'brandName': inputs.itemById('brandName').value.strip() or None,
        'headerHeight': _slider_mm('headerHeight', inputs),
        'showOuterBorder': inputs.itemById('showOuterBorder').value,
        'borderWidth': _slider_mm('borderWidth', inputs),
        'borderHeight': _slider_mm('borderHeight', inputs),
        'showQrFrame': inputs.itemById('showQrFrame').value,
        'qrFramePadding': _slider_mm('qrFramePadding', inputs),
        'qrFrameWidth': _slider_mm('qrFrameWidth', inputs),
    }
