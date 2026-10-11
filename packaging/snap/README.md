# Snap

```bash
npm run dist:snap            # -> dist/tabchat_<versie>_amd64.snap
snapcraft upload --release=stable dist/tabchat_<versie>_amd64.snap
```

Eenmalig nodig:

```bash
sudo snap install snapcraft --classic
sudo snap install lxd
sudo lxd init --auto
sudo usermod -aG lxd $USER   # daarna opnieuw inloggen (of: newgrp lxd)
```

snapcraft bouwt in een LXD-container, zodat de snap niet afhangt van jouw eigen systeem.
We gebruiken niet de snap-functie van electron-builder: die is in versie 26 kapot
(de snap start niet: "desktop-init.sh: No such file or directory").
