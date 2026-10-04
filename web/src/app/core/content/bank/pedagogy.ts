export interface PedagogyBlock {
  learningObjective: string;
  hints: string[];
}

/**
 * Objectif unique et indices progressifs (A1–A10).
 * Les fiches de part-a.ts gardent le déroulé.
 */
export const PEDAGOGY: Record<string, PedagogyBlock> = {
  A1: {
    learningObjective:
      'créer le commutateur interne LAB-NAT, lui donner 192.168.5.1/24 et ouvrir le NAT pour 192.168.5.0/24.',
    hints: [
      'Le commutateur de l’atelier a un nom fixe. Ce n’est pas celui que Windows propose tout seul.',
      'Le type Internal donne une carte à l’hôte. Tu lis son nom avec Get-NetAdapter avant de poser 192.168.5.1.',
      'New-VMSwitch -Name "LAB-NAT" -SwitchType Internal, puis New-NetIPAddress, puis New-NetNat sur 192.168.5.0/24.',
    ],
  },
  A2: {
    learningObjective: 'créer le commutateur privé LAB-PRIVE, sans adresse sur l’hôte.',
    hints: [
      'Ce commutateur relie des machines virtuelles. L’hôte n’y participe pas.',
      'Le type Private ne crée pas de carte vEthernet. Tu n’as donc aucune adresse à poser.',
      'New-VMSwitch -Name "LAB-PRIVE" -SwitchType Private. Get-NetAdapter ne doit pas montrer LAB-PRIVE.',
    ],
  },
  A3: {
    learningObjective:
      'créer LAB-FW-OPN-01, avec le WAN sur LAB-NAT, le LAN sur LAB-PRIVE, et le démarrage sécurisé éteint.',
    hints: [
      'La machine a deux cartes. La première vient de New-VM. La seconde s’ajoute et porte un nom.',
      'Génération 2. Le démarrage sécurisé empêche l’image OPNsense de démarrer : tu l’éteins sur cette machine-là.',
      'New-VM … -SwitchName "LAB-NAT", puis Add-VMNetworkAdapter … -Name "LAN" -SwitchName "LAB-PRIVE", puis Set-VMFirmware -EnableSecureBoot Off.',
    ],
  },
  A4: {
    learningObjective: 'installer OPNsense depuis l’image DVD amd64, avec le compte root et un disque ZFS en stripe.',
    hints: [
      'Tu télécharges une image DVD amd64, miroir Init7. Tu la branches comme un lecteur virtuel.',
      'Le compte écrit sur l’image n’est pas encore root. Après l’installation, le compte de l’atelier est root.',
      'Install (ZFS), stripe, un seul disque. Mots de passe de l’atelier : installer / opnsense, puis root / opnsense. Tu retires le DVD à la fin.',
    ],
  },
  A5: {
    learningObjective: 'poser le WAN fixe 192.168.5.2/24 et le LAN 192.168.10.1/24, sans créer de VLAN.',
    hints: [
      'LAB-NAT ne répond pas au DHCP. Le WAN a donc une adresse écrite à la main.',
      'WAN 192.168.5.2/24, passerelle 192.168.5.1, DNS public. LAN 192.168.10.1/24, DHCP de .100 à .200.',
      'La première carte (souvent hn0) est le WAN. La carte LAN est le LAN. Tu t’arrêtes là : pas de VLAN.',
    ],
  },
  A6: {
    learningObjective:
      'ouvrir l’interface web depuis le PC physique, en autorisant le HTTPS du réseau 192.168.5.0/24 sur le WAN.',
    hints: [
      'L’hôte n’est pas sur le LAN. L’anti-verrouillage du LAN ne l’aide pas. Son adresse d’entrée est 192.168.5.2.',
      'Le WAN bloque les réseaux privés. Tu décoches ce blocage, puis tu laisses passer le TCP 443 et le TCP 80 depuis 192.168.5.0/24 vers Ce pare-feu.',
      'pfctl -d ouvre la porte le temps d’enregistrer les règles. pfctl -e la referme. La page doit encore s’ouvrir après.',
    ],
  },
  A7: {
    learningObjective:
      'installer Windows 11 sur LAB-PRIVE sans VLAN, et rediriger le RDP du WAN vers son adresse DHCP.',
    hints: [
      'Une seule carte, sur LAB-PRIVE. Tu ne poses pas de VLAN. Le démarrage sécurisé et le TPM restent allumés.',
      'L’édition Pro reçoit le Bureau à distance. Tu notes l’adresse que le DHCP a donnée, dans 192.168.10.100–200.',
      'Redirection WAN : TCP 3389 vers cette adresse, même port, avec la règle de filtrage associée.',
    ],
  },
  A8: {
    learningObjective:
      'créer les VLAN 10 et 20 sur OPNsense, avec leur DHCP, et laisser la deuxième machine sans tag.',
    hints: [
      'Le parent est le LAN. VLAN 10 : 192.168.110.1/24. VLAN 20 : 192.168.120.1/24. Le LAN sans tag reste.',
      'Le refus entre les deux VLAN se place au-dessus de la règle qui laisse sortir. Sinon ils se parlent.',
      'Tu crées LAB-PC-LX-01 sur LAB-PRIVE. Tu ne lances pas encore Set-VMNetworkAdapterVlan.',
    ],
  },
  A9: {
    learningObjective:
      'régler le trunk et les accès VLAN sur l’hôte Hyper-V, puis mettre à jour la redirection RDP.',
    hints: [
      'Il n’y a pas de commutateur physique. La commande se tape sur l’hôte.',
      'La carte nommée LAN passe en trunk 10,20 avec NativeVlanId 0. Windows passe en accès 10. L’autre machine passe en accès 20.',
      'Windows change d’adresse. Tu notes le bail 192.168.110.x et tu le mets à la place de l’ancienne cible du port 3389.',
    ],
  },
  A10: {
    learningObjective:
      'prouver que les deux clients ne se parlent pas, que chacun sort sur Internet, et que le PC physique ouvre encore l’interface web.',
    hints: [
      'Même commutateur LAB-PRIVE, deux VLAN : un ping entre eux doit échouer.',
      'Chaque client passe par sa passerelle .1, puis par OPNsense, puis par le NAT de l’hôte.',
      'L’hôte n’est pas dans les VLAN. Il ouvre toujours https://192.168.5.2.',
    ],
  },
};
