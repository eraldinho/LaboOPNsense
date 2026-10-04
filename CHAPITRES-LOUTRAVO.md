# Chapitres Labo OPNsense à coller dans Loutravo

Admin → Applis d’activité guidées. Cette appli n’est pas encore une carte : on colle la liste au moment de la créer.

Pour chaque ligne : **numéro** (jaune) et **titre** (blanc), dans cet ordre. Le titre ne contient pas le numéro. Loutravo fabrique l’id à partir du titre.

URL de lancement :

```
https://lab-opnsense.web.app
```

Aussi : `https://lab-opnsense.firebaseapp.com`

Loutravo ajoute `?launch=CODE`. L’appli utilise les id renvoyés par `redeemLaunch` et aligne le texte sur le titre ou le numéro.

```
A1    Commutateur interne et NAT
A2    Commutateur privé LAB-PRIVE
A3    Machine virtuelle OPNsense
A4    Installer OPNsense
A5    Adresses WAN et LAN
A6    Pare-feu : interface web depuis le WAN
A7    Windows 11 sans VLAN et redirection RDP
A8    VLAN 10 et 20 sur OPNsense
A9    Ports Hyper-V en trunk et en accès
A10   Vérifier l’isolation et Internet
```

A5 et A10 sont les jalons.
