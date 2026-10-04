# Parcours Labo OPNsense

Dix chapitres. On ne change pas l’ordre. On ne saute pas. Les VLAN des cartes Hyper-V se règlent seulement après leur création sur OPNsense (chapitre A9, pas avant).

Il n’y a pas de commutateur physique, pas de clé USB comme chemin d’installation, pas d’Active Directory.

## Réseau

| Rôle | Nom | Adresse |
|---|---|---|
| Commutateur interne | LAB-NAT | 192.168.5.0/24 |
| Hôte | vEthernet (LAB-NAT), nom à confirmer avec Get-NetAdapter | 192.168.5.1/24 |
| NAT Windows | LAB-NAT | préfixe 192.168.5.0/24 |
| Commutateur privé | LAB-PRIVE | aucune adresse sur l’hôte |
| Pare-feu | LAB-FW-OPN-01 | WAN 192.168.5.2/24, LAN 192.168.10.1/24 |
| DHCP LAN | OPNsense | 192.168.10.100–192.168.10.200 |
| Client Windows | LAB-PC-WIN-01 | DHCP LAN, puis DHCP VLAN 10 |
| Deuxième client | LAB-PC-LX-01 | créé sans tag, puis DHCP VLAN 20 |
| VLAN 10 | parent LAN | 192.168.110.0/24, passerelle .1, DHCP .100–.200 |
| VLAN 20 | parent LAN | 192.168.120.0/24, passerelle .1, DHCP .100–.200 |

Le WAN est fixe. `New-NetNat` ne distribue pas d’adresses, et ce commutateur interne n’a pas d’autre serveur DHCP. Une demande DHCP sur LAB-NAT resterait sans réponse. DNS du WAN : 1.1.1.1 ou 9.9.9.9. Passerelle du WAN : 192.168.5.1.

On n’utilise pas le Default Switch. On n’utilise pas le partage de connexion Internet : il réécrirait l’hôte en 192.168.137.1.

## Ordre

1. A1 — Commutateur interne LAB-NAT, adresse de l’hôte, NAT.
2. A2 — Commutateur privé LAB-PRIVE.
3. A3 — Machine LAB-FW-OPN-01, génération 2, WAN sur LAB-NAT, carte LAN sur LAB-PRIVE, démarrage sécurisé éteint.
4. A4 — Image DVD amd64, miroir Init7, compte installer / opnsense puis root / opnsense, ZFS stripe, DVD virtuel.
5. A5 — Jalon adresses. WAN fixe et LAN, sans VLAN.
6. A6 — Règles WAN pour ouvrir https://192.168.5.2 depuis l’hôte. L’anti-verrouillage est sur le LAN seulement.
7. A7 — Windows 11 Pro LAB-PC-WIN-01, sans VLAN, redirection TCP 3389 vers son adresse DHCP.
8. A8 — VLAN 10 et 20 sur OPNsense, règles de sortie, refus entre les deux VLAN, création de LAB-PC-LX-01. Les cartes Hyper-V ne changent pas encore.
9. A9 — Trunk sur la carte LAN d’OPNsense (`AllowedVlanIdList 10,20`, `NativeVlanId 0`). Windows en accès VLAN 10. Deuxième machine en accès VLAN 20. La redirection 3389 suit la nouvelle adresse DHCP de Windows.
10. A10 — Jalon atelier. Les deux clients ne se parlent pas. Chacun sort sur Internet par OPNsense puis par le NAT de l’hôte. Le PC physique ouvre encore l’interface web par le WAN.

## Sortie Internet

Le client parle à sa passerelle .1. OPNsense traduit vers 192.168.5.2. L’hôte traduit 192.168.5.0/24 vers Internet. Deux traductions : c’est le plan.
