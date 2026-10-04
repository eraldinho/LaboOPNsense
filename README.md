# Labo OPNsense

Activité guidée Loutravo. L’élève construit un pare-feu OPNsense sur Hyper-V, puis deux VLAN. L’interface est en français (`lang="fr-CH"`).

Loutravo garde l’identité, le droit de démarrer et l’avancement. Cette appli guide les chapitres et envoie `started` / `completed`. Elle n’a pas de compte élève.

Adresse : https://lab-opnsense.web.app

Aussi : https://lab-opnsense.firebaseapp.com

Projet Firebase Hosting : `lab-opnsense` (site `lab-opnsense`). Hébergement seulement : pas d’Auth, pas de Firestore, pas de Storage, pas de Functions sur ce projet. Le hub reste `https://europe-west1-loutravo.cloudfunctions.net`.

## Réseau

| Rôle | Valeur |
|---|---|
| Commutateur interne | `LAB-NAT`, `192.168.5.0/24` |
| Hôte | `192.168.5.1/24` sur `vEthernet (LAB-NAT)` (confirmer avec `Get-NetAdapter`) |
| NAT Windows | `New-NetNat` pour `192.168.5.0/24` |
| Commutateur privé | `LAB-PRIVE`, aucune adresse sur l’hôte |
| OPNsense WAN | `192.168.5.2/24`, passerelle `192.168.5.1`, DNS `1.1.1.1` ou `9.9.9.9` |
| OPNsense LAN | `192.168.10.1/24`, DHCP `192.168.10.100–192.168.10.200` |
| VLAN 10 | `192.168.110.0/24`, passerelle `.1`, DHCP `.100–.200` |
| VLAN 20 | `192.168.120.0/24`, passerelle `.1`, DHCP `.100–.200` |

Le WAN est fixe. `New-NetNat` ne distribue pas d’adresses : sur ce commutateur interne, une demande DHCP ne recevrait pas de réponse. Le DHCP des clients est celui d’OPNsense, sur le LAN puis sur les VLAN.

On n’utilise pas le Default Switch. On n’utilise pas le partage de connexion Internet. Il n’y a pas de commutateur physique : le VLAN des machines se règle sur l’hôte (`Set-VMNetworkAdapterVlan`).

Le plan complet est dans `PARCOURS.md`. La liste à coller dans l’admin est dans `CHAPITRES-LOUTRAVO.md`.

## Lancer en local

Depuis `web/` :

```
npm start
```

Sans `?launch=`, la séance locale (mock) est autorisée seulement hors production (`allowMock`). L’adresse de développement est http://localhost:4200/ . L’aperçu professeur local est http://localhost:4200/?preview=1 .

En production, `allowMock` est faux. Sans code Loutravo, l’écran dit de relancer l’activité depuis Loutravo.

## Contrôle et publication

Depuis `web/` :

```
npm test
npm run deploy
```

`npm test` lance `scripts/check-pedagogy.ts`. `npm run deploy` construit l’appli puis publie l’hébergement du projet `lab-opnsense`. Le dossier publié est `dist/lab-opnsense/browser`.

La carte n’est pas créée dans l’admin Loutravo par ce dépôt. On colle les dix lignes de `CHAPITRES-LOUTRAVO.md` à la main.
