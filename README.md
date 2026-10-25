# topsys

systemd unit status in the GNOME 50 top bar. Click a unit to stop or start it.

## Disclaimer

**This is an AI-assisted personal project.** I vibed it into existence with an LLM. I could have written it manually, I chose not to. I am not a systemd D-Bus expert, I am not a GNOME extension wizard. The code works for me; whether it works for you is your problem.

**This is not a community project.** I will not merge pull requests. I will not respond to issues. I know that is considered a dick move in the open-source community. Consider yourself warned.

If that is a problem for you, fork it.

## What it does

- One dot per configured unit on the left side of the top bar
- An optional probe command checks that an active unit actually works
- Grey while starting or stopping, green when active, yellow when active but the probe fails, red when inactive or failed
- Click stops a green or yellow unit and starts a red one

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

## Configure

Map each unit to a probe command, `[]` for none:

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/topsys@nurett.in/schemas \
    set in.nurett.topsys units "{'sshd.service': [], 'myvpn.service': ['ping', '-c', '1', '-W', '2', '10.0.0.1']}"
```

`probe-interval-s` sets the seconds between probes (default 10). Starting or stopping a system unit asks for your password unless a polkit rule allows `org.freedesktop.systemd1.manage-units` for it.

## Requirements

- GNOME Shell 50

## License

GPL-2.0-or-later. See `LICENSE`.
