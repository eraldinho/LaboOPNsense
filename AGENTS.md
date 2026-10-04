# Labo OPNsense

Activité guidée Loutravo. Dix chapitres, A1 à A10, dans cet ordre. Pas de partie B. Pas de parcours Active Directory.

## Réseau figé

- Commutateur interne `LAB-NAT` : `192.168.5.0/24`, hôte `192.168.5.1`, NAT Windows. Pas le Default Switch. Ce NAT ne sert pas de DHCP.
- Commutateur privé `LAB-PRIVE` : aucune adresse sur l’hôte.
- OPNsense `LAB-FW-OPN-01` : WAN fixe `192.168.5.2/24` (passerelle `192.168.5.1`), LAN `192.168.10.1/24`.
- Windows `LAB-PC-WIN-01` : d’abord sans VLAN, puis accès VLAN 10 (`192.168.110.0/24`).
- Deuxième machine `LAB-PC-LX-01` : créée au chapitre A8, accès VLAN 20 seulement au chapitre A9 (`192.168.120.0/24`).
- Pas de commutateur physique. Le VLAN se règle sur l’hôte avec `Set-VMNetworkAdapterVlan`.

Le détail est dans `PARCOURS.md`. Le texte élève est dans `web/src/app/core/content/bank/part-a.ts`.

## Dépôt

Cette appli est un dépôt à part. On ne la pousse pas dans `loutravo` ni dans `LaboInfra`. La carte Admin se colle depuis `CHAPITRES-LOUTRAVO.md`, elle ne s’écrit pas toute seule.

Hébergement : projet Firebase `lab-opnsense`, site `lab-opnsense`, dossier `web/dist/lab-opnsense/browser`. Pas d’Auth, pas de Firestore, pas de Storage sur ce projet.
