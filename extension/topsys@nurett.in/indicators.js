import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {UnitWatcher} from './units.js';

// strongswan@myvpn.service -> myvpn, sshd.service -> sshd
function shortName(unit) {
    const base = unit.slice(0, unit.lastIndexOf('.'));
    return base.slice(base.indexOf('@') + 1);
}

export const UnitIndicator = GObject.registerClass(
class UnitIndicator extends PanelMenu.Button {
    _init(unit, probe, probeIntervalS) {
        super._init(0.0, unit, true);

        this._dot = new St.Label({
            text: '●',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        box.add_child(this._dot);
        box.add_child(new St.Label({
            text: shortName(unit),
            y_align: Clutter.ActorAlign.CENTER,
        }));
        this.add_child(box);

        this._watcher = new UnitWatcher(unit, probe, probeIntervalS, () => this._update());
        this.connect('button-press-event', () => {
            this._watcher.toggle(e => Main.notifyError('TopSys', `${unit}: ${e.message}`));
            return Clutter.EVENT_STOP;
        });
        this._update();
    }

    destroy() {
        this._watcher.destroy();
        super.destroy();
    }

    _update() {
        this._dot.style_class = `topsys-${this._watcher.health()}`;
    }
});
