// SPDX-FileCopyrightText: GSConnect Developers https://github.com/GSConnect
// SPDX-FileCopyrightText: scrcpy-kdeconnect contributors
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import Plugin from '../plugin.js';


export const Metadata = {
    label: _('Scrcpy Mirror'),
    description: _('Mirror the phone display or a single app with scrcpy'),
    id: 'org.gnome.Shell.Extensions.GSConnect.Plugin.Scrcpy',
    // This plugin is local to the computer and does not exchange packets, so
    // there is no KDE Connect capability to match. The fork keeps it loaded
    // for every device instead of faking a capability (which would steal
    // packet handlers from the real plugin).
    alwaysSupported: true,
    incomingCapabilities: [],
    outgoingCapabilities: [],
    actions: {
        mirrorPhone: {
            label: _('Mirror phone'),
            icon_name: 'video-display-symbolic',
            parameter_type: null,
            incoming: [],
            outgoing: [],
        },
        mirrorApp: {
            label: _('Mirror app…'),
            icon_name: 'window-new-symbolic',
            parameter_type: null,
            incoming: [],
            outgoing: [],
        },
        setupPin: {
            label: _('Set unlock PIN…'),
            icon_name: 'dialog-password-symbolic',
            parameter_type: null,
            incoming: [],
            outgoing: [],
        },
        setupPhone: {
            label: _('Set up phone…'),
            icon_name: 'network-wireless-symbolic',
            parameter_type: null,
            incoming: [],
            outgoing: [],
        },
    },
};


/**
 * Scrcpy Mirror Plugin
 *
 * Adds local-only actions to the device menu that start the scrcpy-kdeconnect
 * systemd user units. The units are provided by the scrcpy-kdeconnect project:
 * https://github.com/goodeesh/scrcpy-kdeconnect
 */
const ScrcpyPlugin = GObject.registerClass({
    GTypeName: 'GSConnectScrcpyPlugin',
}, class ScrcpyPlugin extends Plugin {

    _init(device) {
        super._init(device, 'scrcpy');

        // The mirror actions do not depend on the KDE Connect channel, so
        // they stay enabled even while the device is disconnected. This also
        // keeps "Set up phone…" reachable when the phone has no ADB transport.
        for (const action of this._gactions)
            action.set_enabled(true);

        this._addMenuItems();
    }

    _addMenuItems() {
        // Place the mirror actions right below "Ring" when it is present.
        let index = this.device.getMenuAction('device.ring');

        if (index > -1)
            index += 1;

        for (const name of Object.keys(Metadata.actions)) {
            const action = this.device.lookup_action(name);

            if (action === null)
                continue;

            const info = Metadata.actions[name];
            const position = this.device.addMenuAction(
                action,
                index,
                info.label,
                info.icon_name
            );

            if (index > -1 && position > -1)
                index = position + 1;
        }
    }

    _spawn(unit) {
        try {
            const proc = Gio.Subprocess.new(
                ['systemctl', '--user', 'start', '--no-block', unit],
                Gio.SubprocessFlags.STDOUT_SILENCE |
                Gio.SubprocessFlags.STDERR_SILENCE
            );

            proc.wait_check_async(null, (subprocess, res) => {
                try {
                    subprocess.wait_check_finish(res);
                } catch (e) {
                    logError(e, `scrcpy: ${unit}`);
                    this.device.showNotification({
                        id: 'scrcpy-error',
                        title: _('Scrcpy'),
                        body: _('Could not start %s. Is scrcpy-kdeconnect installed?').format(unit),
                        icon: new Gio.ThemedIcon({name: 'dialog-warning-symbolic'}),
                        priority: Gio.NotificationPriority.HIGH,
                    });
                }
            });
        } catch (e) {
            logError(e, `scrcpy: ${unit}`);
        }
    }

    connected() {
        super.connected();

        for (const action of this._gactions)
            action.set_enabled(true);
    }

    disconnected() {
        super.disconnected();

        // Keep local actions available while the phone is away; ADB may still
        // be up, and the setup actions are exactly what an offline phone needs.
        for (const action of this._gactions)
            action.set_enabled(true);
    }

    mirrorPhone() {
        this._spawn('scrcpy-mirror.service');
    }

    mirrorApp() {
        this._spawn('scrcpy-mirror-app.service');
    }

    setupPin() {
        this._spawn('scrcpy-pin.service');
    }

    setupPhone() {
        this._spawn('scrcpy-pair.service');
    }
});

export default ScrcpyPlugin;
