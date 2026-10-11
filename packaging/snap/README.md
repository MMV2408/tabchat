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

## Automatisch via GitHub Actions

`.github/workflows/snap.yml` bouwt bij elke nieuwe GitHub-release de snap en zet hem in de
Snap Store. Eenmalig nodig: een sleutel als geheim in de repo.

```bash
snapcraft export-login --snaps=tabchat --acls package_access,package_push,package_update,package_release snapcraft-login.txt
gh secret set SNAPCRAFT_STORE_CREDENTIALS < snapcraft-login.txt
rm snapcraft-login.txt
```
