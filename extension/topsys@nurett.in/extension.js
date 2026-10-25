import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {UnitIndicator} from './indicators.js';

// The right side is full of toptop graphs; a negative index appends.
const END_OF_LEFT_BOX = -1;

export default class TopSysExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicators = [];
        this._buildIndicators();
        this._settingsHandler = this._settings.connect('changed', () => this._rebuildIndicators());
    }

    disable() {
        this._settings.disconnect(this._settingsHandler);
        this._settingsHandler = null;
        this._destroyIndicators();
        this._settings = null;
    }

    _buildIndicators() {
        const units = this._settings.get_value('units').deepUnpack();
        const probeIntervalS = this._settings.get_int('probe-interval-s');
        for (const [unit, probe] of Object.entries(units)) {
            const ind = new UnitIndicator(unit, probe, probeIntervalS);
            Main.panel.addToStatusArea(`topsys-${unit}`, ind, END_OF_LEFT_BOX, 'left');
            this._indicators.push(ind);
        }
    }

    _destroyIndicators() {
        for (const ind of this._indicators) ind.destroy();
        this._indicators = [];
    }

    _rebuildIndicators() {
        this._destroyIndicators();
        this._buildIndicators();
    }
}
