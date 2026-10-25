# topsys

systemd unit status in the GNOME 50 top bar, with a click to stop or start each unit.

## Disclaimer

**This is an AI-assisted personal project.** I vibed it into existence with an LLM. I could have written it manually, I chose not to. I am not a systemd D-Bus expert, I am not a GNOME extension wizard. The code works for me; whether it works for you is your problem.

**This is not a community project.** I will not merge pull requests. I will not respond to issues. I know that is considered a dick move in the open-source community. Consider yourself warned.

If that is a problem for you, fork it.

## Why

I bring up a strongSwan VPN with `systemctl start strongswan@myvpn`. That unit is `Type=oneshot` with `RemainAfterExit=yes`, so systemd keeps calling it "active" long after the tunnel died, and `systemctl start` on it does nothing. I wanted a dot that tells the truth and a button that fixes it.

## What it does

- One panel item per configured unit at the end of the left side of the top bar: a coloured dot and a short name (`strongswan@myvpn.service` shows as `myvpn`)
- Unit state comes from systemd over D-Bus, no polling
- An optional probe command runs every few seconds while the unit is active; a non-zero exit means the unit is lying
- Dot colours:
  - grey: starting, stopping, or first probe pending
  - green: active and the probe passes
  - yellow: active but the probe fails
  - red: inactive or failed
- Click toggles the unit: green or yellow stops it, red starts it, grey ignores clicks until the unit settles

## Install

```bash
git clone https://github.com/nurettin/gnome-extensions-topsys.git
ln -s "$PWD/gnome-extensions-topsys/extension/topsys@nurett.in" \
      ~/.local/share/gnome-shell/extensions/topsys@nurett.in
glib-compile-schemas \
      ~/.local/share/gnome-shell/extensions/topsys@nurett.in/schemas/
# Log out and log back in (Wayland needs a fresh shell to see new extensions)
gnome-extensions enable topsys@nurett.in
```

## Permissions

Starting or stopping a system unit goes through polkit. Without a rule, every click asks for your password. To allow it without a prompt, drop a rule like this into `/etc/polkit-1/rules.d/50-strongswan.rules` (replace the user name):

```js
polkit.addRule(function(action, subject) {
    if (action.id == "org.freedesktop.systemd1.manage-units" &&
        action.lookup("unit").startsWith("strongswan@") &&
        subject.user == "you") {
        var verb = action.lookup("verb");
        if (verb == "start" || verb == "stop" || verb == "restart")
            return polkit.Result.YES;
    }
});
```

## strongSwan tip

If the network drops, the old IKE_SA can hang around retransmitting, and a plain `swanctl --terminate` gives up on it, leaving it next to the next connection. Let the unit force it after a clean attempt:

```ini
ExecStopPost=-/usr/bin/swanctl --terminate --ike %i --force --timeout 10
```

## Configure

Nothing is shown until you list some units. The schema lives in the extension, so point `gsettings` at it:

```bash
alias topsys-settings='gsettings --schemadir ~/.local/share/gnome-shell/extensions/topsys@nurett.in/schemas'
# unit name -> probe argv; [] leaves the status to systemd alone
topsys-settings set in.nurett.topsys units \
    "{'strongswan@myvpn.service': ['ping', '-c', '1', '-W', '2', '10.0.0.1']}"
topsys-settings set in.nurett.topsys probe-interval-s 10   # seconds between probes (2..600)
```

## Requirements

- GNOME Shell 50
- whatever your probe commands need (`ping` from iputils for the example above)

## License

GPL-2.0-or-later. See `LICENSE`.
