"""Add-in entry point. Fusion calls run(context) when the add-in is enabled
(Utilities > Add-Ins > Scripts and Add-Ins > Add-Ins tab > Run) and
stop(context) when it's disabled or Fusion closes.
"""

import os
import sys
import traceback

import adsk.core

_ADDIN_DIR = os.path.dirname(os.path.abspath(__file__))
if _ADDIN_DIR not in sys.path:
    sys.path.insert(0, _ADDIN_DIR)

from commands import CreateQrPlateCommand  # noqa: E402

_app = None
_ui = None


def run(context):
    global _app, _ui
    try:
        _app = adsk.core.Application.get()
        _ui = _app.userInterface

        cmd_def = CreateQrPlateCommand.create_command_definition()
        CreateQrPlateCommand.add_to_panel(cmd_def)

        adsk.autoTerminate(False)
    except Exception:
        if _ui:
            _ui.messageBox('UPI QR Card add-in failed to start:\n{}'.format(traceback.format_exc()))


def stop(context):
    try:
        CreateQrPlateCommand.remove_from_panel()
    except Exception:
        if _ui:
            _ui.messageBox('UPI QR Card add-in failed to stop cleanly:\n{}'.format(traceback.format_exc()))
