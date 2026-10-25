import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const SYSTEMD = 'org.freedesktop.systemd1';
const SYSTEMD_PATH = '/org/freedesktop/systemd1';
const MANAGER_IFACE = 'org.freedesktop.systemd1.Manager';
const UNIT_IFACE = 'org.freedesktop.systemd1.Unit';
const ALREADY_SUBSCRIBED = 'org.freedesktop.systemd1.AlreadySubscribed';

export const Health = Object.freeze({
    PENDING: 'pending',
    UP: 'up',
    DEGRADED: 'degraded',
    DOWN: 'down',
});

// Clicks while starting or stopping are ignored.
const TOGGLE_METHODS = Object.freeze({
    [Health.UP]: 'StopUnit',
    [Health.DEGRADED]: 'StopUnit',
    [Health.DOWN]: 'StartUnit',
});

function callManager(method, params, flags, cancellable, callback) {
    Gio.DBus.system.call(
        SYSTEMD, SYSTEMD_PATH, MANAGER_IFACE, method, params,
        null, flags, -1, cancellable, callback
    );
}

// systemd only emits unit PropertiesChanged while some client is subscribed.
// The subscription belongs to the shell's shared system bus connection, so
// repeating it is harmless and undoing it could starve other shell code.
function subscribe() {
    callManager('Subscribe', null, Gio.DBusCallFlags.NONE, null, (conn, res) => {
        try {
            conn.call_finish(res);
        } catch (e) {
            if (Gio.DBusError.get_remote_error(e) !== ALREADY_SUBSCRIBED)
                throw e;
        }
    });
}

export class UnitWatcher {
    constructor(name, probe, probeIntervalS, onChanged) {
        this.name = name;
        this._probe = probe;
        this._onChanged = onChanged;
        this._cancellable = new Gio.Cancellable();
        this._proxy = null;
        this._proxyHandlerId = null;
        this._probeOk = null;
        this._probing = false;
        this._timeoutId = probe.length === 0 ? null : GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, probeIntervalS, () => {
                this._runProbe();
                return GLib.SOURCE_CONTINUE;
            }
        );

        subscribe();
        callManager('LoadUnit', new GLib.Variant('(s)', [name]),
            Gio.DBusCallFlags.NONE, this._cancellable, (conn, res) => {
                if (this._cancellable.is_cancelled()) return;
                const [path] = conn.call_finish(res).deepUnpack();
                Gio.DBusProxy.new(
                    conn, Gio.DBusProxyFlags.NONE, null,
                    SYSTEMD, path, UNIT_IFACE, this._cancellable,
                    (_source, proxyRes) => {
                        if (this._cancellable.is_cancelled()) return;
                        this._proxy = Gio.DBusProxy.new_finish(proxyRes);
                        if (this._proxy.get_cached_property('LoadState').unpack() === 'not-found')
                            throw new Error(`topsys: ${name} not found`);
                        this._proxyHandlerId = this._proxy.connect(
                            'g-properties-changed', () => this._onStateChanged()
                        );
                        this._onStateChanged();
                    }
                );
            }
        );
    }

    destroy() {
        this._cancellable.cancel();
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = null;
        if (this._proxyHandlerId)
            this._proxy.disconnect(this._proxyHandlerId);
        this._proxyHandlerId = null;
        this._proxy = null;
    }

    health() {
        const state = this._activeState();
        if (state === 'inactive' || state === 'failed') return Health.DOWN;
        if (state !== 'active') return Health.PENDING;
        if (this._probe.length === 0) return Health.UP;
        if (this._probeOk === null) return Health.PENDING;
        return this._probeOk ? Health.UP : Health.DEGRADED;
    }

    toggle(onError) {
        const method = TOGGLE_METHODS[this.health()];
        if (!method) return;
        callManager(method, new GLib.Variant('(ss)', [this.name, 'replace']),
            Gio.DBusCallFlags.ALLOW_INTERACTIVE_AUTHORIZATION, this._cancellable,
            (conn, res) => {
                if (this._cancellable.is_cancelled()) return;
                try {
                    conn.call_finish(res);
                } catch (e) {
                    Gio.DBusError.strip_remote_error(e);
                    onError(e);
                }
            }
        );
    }

    _activeState() {
        return this._proxy?.get_cached_property('ActiveState').unpack() ?? null;
    }

    _onStateChanged() {
        if (this._activeState() !== 'active')
            this._probeOk = null;
        else if (this._probeOk === null)
            this._runProbe();
        this._onChanged();
    }

    _runProbe() {
        if (this._probe.length === 0 || this._probing || this._activeState() !== 'active')
            return;
        this._probing = true;
        const proc = Gio.Subprocess.new(
            this._probe,
            Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
        );
        proc.wait_async(this._cancellable, (_proc, res) => {
            if (this._cancellable.is_cancelled()) return;
            proc.wait_finish(res);
            this._probing = false;
            if (this._activeState() !== 'active') return;
            this._probeOk = proc.get_successful();
            this._onChanged();
        });
    }
}
