import { ChapterSeed } from '../chapter.types';

/**
 * Parcours Labo OPNsense. Dix chapitres, dans cet ordre.
 * Le WAN est fixe : ce commutateur interne n’a pas de serveur DHCP.
 */
export const PART_A: ChapterSeed[] = [
  {
    id: 'commutateur-interne-et-nat',
    code: 'A1',
    title: 'A1 — Commutateur interne et NAT',
    part: 'A',
    duration: '1 h',
    summary:
      'Tu crées le réseau LAB-NAT sur l’hôte Hyper-V. L’hôte y a l’adresse 192.168.5.1. Le NAT de Windows laisse sortir ce réseau vers Internet.',
    objectives: [
      'Créer un commutateur virtuel interne nommé LAB-NAT',
      'Poser l’adresse 192.168.5.1/24 sur la carte de l’hôte',
      'Créer le NAT Windows pour 192.168.5.0/24',
      'Laisser le Default Switch de côté',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'Tu es dans Labo OPNsense. Tu construis un petit réseau virtuel sur l’hôte Hyper-V : un pare-feu OPNsense, deux réseaux, puis deux VLAN.',
          'Ce chapitre prépare le réseau qui ira vers Internet. Il s’appelle LAB-NAT. L’hôte Windows y participe. Plus tard, la carte WAN d’OPNsense sera branchée ici.',
          'Tu lis. Tu tapes les commandes dans PowerShell ouvert en administrateur. Tu coches seulement ce que tu as vraiment fait. Tu réponds au quiz. Puis tu dis à Loutravo que le chapitre est fini.',
          'Les chapitres vont dans l’ordre. On ne saute pas.',
        ],
      },
      {
        title: 'Pourquoi un commutateur interne',
        paragraphs: [
          'Un commutateur interne relie l’hôte et les machines virtuelles. Windows crée une carte virtuelle sur l’hôte. Son nom habituel est vEthernet (LAB-NAT). Tu confirmes ce nom avec Get-NetAdapter avant de poser l’adresse.',
          'Tu n’utilises pas le Default Switch. Cette carte change d’adresse toute seule et son DHCP ne suit pas le plan de l’atelier.',
          'Le NAT que tu crées traduit 192.168.5.0/24 vers Internet. Il ne distribue pas d’adresses. Une demande DHCP sur LAB-NAT ne reçoit pas de réponse.',
        ],
        callout: {
          type: 'rule',
          text: 'Le commutateur s’appelle LAB-NAT. Son type est Internal. L’hôte porte 192.168.5.1/24. Le préfixe du NAT est 192.168.5.0/24.',
        },
      },
    ],
    vigilance: [
      'Get-VMSwitch affiche LAB-NAT, type Internal.',
      'Get-NetIPAddress affiche 192.168.5.1/24 sur vEthernet (LAB-NAT), ou sur le nom que Get-NetAdapter t’a montré.',
      'Get-NetNat affiche LAB-NAT et le préfixe 192.168.5.0/24.',
      'Le Default Switch n’a pas reçu ces adresses.',
    ],
    deliverable: 'Les trois commandes Get montrent LAB-NAT, l’adresse 192.168.5.1/24 et le NAT 192.168.5.0/24.',
    resources: 'Documentation Microsoft des trois commandes de ce chapitre.',
    resourceFiles: [
      { label: 'New-VMSwitch', url: 'https://learn.microsoft.com/powershell/module/hyper-v/new-vmswitch' },
      { label: 'New-NetIPAddress', url: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netipaddress' },
      { label: 'New-NetNat', url: 'https://learn.microsoft.com/powershell/module/netnat/new-netnat' },
    ],
    commands: [
      'New-VMSwitch -Name "LAB-NAT" -SwitchType Internal',
      'Get-NetAdapter',
      'New-NetIPAddress -IPAddress 192.168.5.1 -PrefixLength 24 -InterfaceAlias "vEthernet (LAB-NAT)"',
      'New-NetNat -Name "LAB-NAT" -InternalIPInterfaceAddressPrefix "192.168.5.0/24"',
      'Get-VMSwitch -Name "LAB-NAT"',
      'Get-NetNat -Name "LAB-NAT"',
    ],
    checklist: [
      { id: 'a1-switch', label: 'J’ai créé le commutateur interne LAB-NAT.' },
      { id: 'a1-adapter', label: 'J’ai lu le nom de la carte avec Get-NetAdapter et je l’ai utilisé pour l’adresse.' },
      { id: 'a1-ip', label: 'L’hôte a 192.168.5.1/24 sur cette carte.' },
      { id: 'a1-nat', label: 'Le NAT LAB-NAT couvre 192.168.5.0/24.' },
    ],
    quiz: [
      {
        id: 'a1-q1',
        prompt: 'Quel commutateur portes-tu à 192.168.5.1 ?',
        choices: ['Le Default Switch', 'LAB-NAT, type Internal', 'LAB-PRIVE, type Private'],
        correctIndex: 1,
        explain: 'LAB-NAT est le commutateur interne de l’atelier. Le Default Switch ne sert pas ici.',
      },
      {
        id: 'a1-q2',
        prompt: 'Que fait New-NetNat dans ce chapitre ?',
        choices: [
          'Il traduit 192.168.5.0/24 vers Internet',
          'Il distribue des adresses DHCP',
          'Il crée une carte sur le commutateur privé',
        ],
        correctIndex: 0,
        explain: 'Ce NAT traduit les adresses. Il ne répond pas aux demandes DHCP.',
      },
      {
        id: 'a1-q3',
        prompt: 'Quelle adresse a l’hôte sur LAB-NAT ?',
        choices: ['192.168.5.2/24', '192.168.10.1/24', '192.168.5.1/24'],
        correctIndex: 2,
        explain: 'L’hôte est 192.168.5.1/24. 192.168.5.2 sera le WAN d’OPNsense, plus tard.',
      },
    ],
  },
  {
    id: 'commutateur-prive-lab-prive',
    code: 'A2',
    title: 'A2 — Commutateur privé LAB-PRIVE',
    part: 'A',
    duration: '45 min',
    summary:
      'Tu crées le commutateur privé LAB-PRIVE. Les machines virtuelles s’y parlent. L’hôte n’a pas de carte sur ce réseau.',
    objectives: [
      'Créer le commutateur LAB-PRIVE en type Private',
      'Comprendre qu’aucune carte vEthernet n’apparaît sur l’hôte',
      'Garder LAB-NAT pour le WAN et LAB-PRIVE pour le LAN',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'LAB-NAT relie l’hôte et, plus tard, le WAN du pare-feu. Le LAN des machines doit rester à part.',
          'Un commutateur privé ne crée pas de carte sur l’hôte. New-VMSwitch -SwitchType Private ne donne donc aucune adresse à Windows. Tu n’en poses pas.',
          'OPNsense et les clients seront branchés ici. L’hôte les atteint seulement en passant par le WAN du pare-feu.',
        ],
        callout: {
          type: 'info',
          text: 'LAB-PRIVE n’a pas d’adresse sur l’hôte. Si une carte vEthernet (LAB-PRIVE) apparaît, le type n’est pas Private.',
        },
      },
    ],
    vigilance: [
      'Get-VMSwitch affiche LAB-PRIVE, type Private.',
      'Get-NetAdapter ne montre pas de carte vEthernet (LAB-PRIVE).',
      'LAB-NAT est toujours là, avec 192.168.5.1/24.',
    ],
    deliverable: 'Get-VMSwitch liste LAB-NAT en Internal et LAB-PRIVE en Private.',
    resources: 'Documentation Microsoft de New-VMSwitch.',
    resourceFiles: [
      { label: 'New-VMSwitch', url: 'https://learn.microsoft.com/powershell/module/hyper-v/new-vmswitch' },
    ],
    commands: [
      'New-VMSwitch -Name "LAB-PRIVE" -SwitchType Private',
      'Get-VMSwitch -Name "LAB-PRIVE"',
      'Get-NetAdapter',
    ],
    checklist: [
      { id: 'a2-switch', label: 'J’ai créé LAB-PRIVE avec -SwitchType Private.' },
      { id: 'a2-no-ip', label: 'Je n’ai pas posé d’adresse sur l’hôte pour ce commutateur.' },
    ],
    quiz: [
      {
        id: 'a2-q1',
        prompt: 'Que crée un commutateur Private sur l’hôte ?',
        choices: ['Une carte vEthernet avec une adresse', 'Aucune carte hôte', 'Un NAT 192.168.5.0/24'],
        correctIndex: 1,
        explain: 'Le type Private relie seulement les machines virtuelles. L’hôte n’y a pas de carte.',
      },
      {
        id: 'a2-q2',
        prompt: 'À quoi servira LAB-PRIVE ?',
        choices: ['Au WAN d’OPNsense et à l’hôte', 'Au LAN des machines virtuelles', 'Au Default Switch'],
        correctIndex: 1,
        explain: 'Le LAN d’OPNsense et les clients seront sur LAB-PRIVE. Le WAN reste sur LAB-NAT.',
      },
      {
        id: 'a2-q3',
        prompt: 'Quelle commande est la bonne ?',
        choices: [
          'New-VMSwitch -Name "LAB-PRIVE" -SwitchType Private',
          'New-VMSwitch -Name "LAB-PRIVE" -SwitchType Internal',
          'New-NetNat -Name "LAB-PRIVE" -InternalIPInterfaceAddressPrefix "192.168.10.0/24"',
        ],
        correctIndex: 0,
        explain: 'LAB-PRIVE est privé. Un type Internal créerait une carte sur l’hôte.',
      },
    ],
  },
  {
    id: 'machine-virtuelle-opnsense',
    code: 'A3',
    title: 'A3 — Machine virtuelle OPNsense',
    part: 'A',
    duration: '1 h 30',
    summary:
      'Tu crées la machine LAB-FW-OPN-01. La première carte est le WAN sur LAB-NAT. La seconde s’appelle LAN et elle est sur LAB-PRIVE. Le démarrage sécurisé est éteint.',
    objectives: [
      'Créer une machine de génération 2 nommée LAB-FW-OPN-01',
      'Brancher le WAN sur LAB-NAT et le LAN sur LAB-PRIVE',
      'Éteindre le démarrage sécurisé pour que l’ISO puisse démarrer',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'OPNsense tourne dans une machine virtuelle. Son nom est LAB-FW-OPN-01. Elle a deux cartes. L’ordre compte.',
          'New-VM -SwitchName LAB-NAT crée la première carte. Ce sera le WAN. Tu ajoutes ensuite une carte nommée LAN sur LAB-PRIVE.',
          'La machine est de génération 2. Le démarrage sécurisé reste éteint : avec lui, l’image OPNsense ne démarre pas. Le TPM ne sert pas pour ce pare-feu.',
        ],
        callout: {
          type: 'warn',
          text: 'Set-VMFirmware -EnableSecureBoot Off concerne LAB-FW-OPN-01. Tu ne l’appliques pas à une future machine Windows 11.',
        },
      },
    ],
    vigilance: [
      'Get-VM affiche LAB-FW-OPN-01, génération 2.',
      'La première carte est sur LAB-NAT. La carte nommée LAN est sur LAB-PRIVE.',
      'Get-VMFirmware montre le démarrage sécurisé éteint.',
    ],
    deliverable: 'La machine existe, avec les deux commutateurs et le démarrage sécurisé éteint. Elle n’est pas encore installée.',
    resources: 'Documentation Microsoft de New-VM, Add-VMNetworkAdapter et Set-VMFirmware.',
    resourceFiles: [
      { label: 'New-VM', url: 'https://learn.microsoft.com/powershell/module/hyper-v/new-vm' },
      { label: 'Add-VMNetworkAdapter', url: 'https://learn.microsoft.com/powershell/module/hyper-v/add-vmnetworkadapter' },
      { label: 'Set-VMFirmware', url: 'https://learn.microsoft.com/powershell/module/hyper-v/set-vmfirmware' },
    ],
    commands: [
      'New-Item -ItemType Directory -Force -Path "C:\\VMs\\LAB-FW-OPN-01"',
      'New-VM -Name "LAB-FW-OPN-01" -MemoryStartupBytes 2GB -Generation 2 -SwitchName "LAB-NAT" -NewVHDPath "C:\\VMs\\LAB-FW-OPN-01\\disque.vhdx" -NewVHDSizeBytes 20GB',
      'Add-VMNetworkAdapter -VMName "LAB-FW-OPN-01" -SwitchName "LAB-PRIVE" -Name "LAN"',
      'Set-VMFirmware -VMName "LAB-FW-OPN-01" -EnableSecureBoot Off',
      'Get-VMNetworkAdapter -VMName "LAB-FW-OPN-01"',
    ],
    checklist: [
      { id: 'a3-vm', label: 'LAB-FW-OPN-01 est une génération 2, avec un disque virtuel.' },
      { id: 'a3-wan', label: 'La première carte est sur LAB-NAT.' },
      { id: 'a3-lan', label: 'La carte nommée LAN est sur LAB-PRIVE.' },
      { id: 'a3-sb', label: 'Le démarrage sécurisé de cette machine est éteint.' },
    ],
    quiz: [
      {
        id: 'a3-q1',
        prompt: 'Quelle carte est le WAN ?',
        choices: ['La carte nommée LAN, sur LAB-PRIVE', 'La première carte, créée sur LAB-NAT', 'Une carte du Default Switch'],
        correctIndex: 1,
        explain: 'New-VM -SwitchName LAB-NAT crée la première carte. C’est le WAN.',
      },
      {
        id: 'a3-q2',
        prompt: 'Pourquoi le démarrage sécurisé est-il éteint ?',
        choices: [
          'Windows 11 l’interdit',
          'Sinon l’image OPNsense ne démarre pas',
          'LAB-PRIVE refuse les machines génération 2',
        ],
        correctIndex: 1,
        explain: 'L’ISO OPNsense ne démarre pas si le démarrage sécurisé est allumé sur cette génération 2.',
      },
      {
        id: 'a3-q3',
        prompt: 'Où est branchée la carte nommée LAN ?',
        choices: ['LAB-NAT', 'Le Default Switch', 'LAB-PRIVE'],
        correctIndex: 2,
        explain: 'Le LAN des machines est le commutateur privé LAB-PRIVE.',
      },
    ],
  },
  {
    id: 'installer-opnsense',
    code: 'A4',
    title: 'A4 — Installer OPNsense',
    part: 'A',
    duration: '2 h',
    summary:
      'Tu télécharges l’image DVD amd64, tu la branches en lecteur virtuel, puis tu installes OPNsense sur le disque en ZFS stripe.',
    objectives: [
      'Télécharger l’image DVD amd64 sur le miroir Init7',
      'Démarrer la machine sur ce DVD virtuel',
      'Installer avec le compte prévu et un disque ZFS en stripe',
      'Retirer le DVD virtuel après l’installation',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'L’installation se fait avec un DVD virtuel. Tu télécharges l’image sur le site officiel, architecture amd64, type DVD. Tu choisis le miroir Init7, en Suisse.',
          'Tu enregistres le fichier ISO sur l’hôte, par exemple dans C:\\ISO. Tu le branches avec Add-VMDvdDrive. Dans la commande, tu remplaces le chemin par le nom réel du fichier. Les deux commandes du lecteur se lancent dans la même fenêtre PowerShell : la seconde utilise la variable $dvd.',
          'Sur l’image, le compte d’installation est installer, mot de passe opnsense. Après l’installation, le compte est root, mot de passe opnsense. Ce sont les mots de passe de cet atelier. Tu les notes. Tu ne les publies pas ailleurs.',
          'Dans l’installeur, tu choisis Install (ZFS), puis stripe, puis le seul disque virtuel. Quand on te demande le mot de passe root, tu mets opnsense.',
          'À la fin, tu retires le DVD virtuel. Sinon la machine redémarre sur l’installeur.',
        ],
        callout: {
          type: 'info',
          text: 'Clavier : français de Suisse si la liste le propose. Sinon tu gardes le clavier proposé et tu tapes les mots de passe lentement.',
        },
      },
    ],
    vigilance: [
      'La console demande un login après le redémarrage, sans revenir au menu de l’installeur.',
      'Tu entres avec root et le mot de passe de l’atelier.',
      'Get-VMDvdDrive ne montre plus de DVD sur LAB-FW-OPN-01.',
    ],
    deliverable: 'OPNsense est installé sur le disque virtuel et la machine démarre sans l’ISO.',
    resources: 'Page de téléchargement et manuel d’installation OPNsense.',
    resourceFiles: [
      { label: 'Télécharger OPNsense', url: 'https://opnsense.org/download/' },
      { label: 'Manuel d’installation', url: 'https://docs.opnsense.org/manual/install.html' },
      { label: 'Add-VMDvdDrive', url: 'https://learn.microsoft.com/powershell/module/hyper-v/add-vmdvddrive' },
    ],
    commands: [
      'Add-VMDvdDrive -VMName "LAB-FW-OPN-01" -Path "C:\\ISO\\OPNsense-dvd-amd64.iso"',
      '$dvd = Get-VMDvdDrive -VMName "LAB-FW-OPN-01"',
      'Set-VMFirmware -VMName "LAB-FW-OPN-01" -FirstBootDevice $dvd',
      'Start-VM -Name "LAB-FW-OPN-01"',
      'Get-VMDvdDrive -VMName "LAB-FW-OPN-01" | Remove-VMDvdDrive',
    ],
    checklist: [
      { id: 'a4-iso', label: 'J’ai l’image DVD amd64, téléchargée sur opnsense.org, miroir Init7.' },
      { id: 'a4-boot', label: 'La machine a démarré sur ce DVD virtuel.' },
      { id: 'a4-accounts', label: 'J’ai utilisé installer / opnsense, puis root / opnsense.' },
      { id: 'a4-zfs', label: 'Le disque est installé en ZFS stripe.' },
      { id: 'a4-eject', label: 'J’ai retiré le DVD virtuel après l’installation.' },
    ],
    quiz: [
      {
        id: 'a4-q1',
        prompt: 'Quelle image télécharges-tu ?',
        choices: ['Une image USB à écrire sur une clé', 'L’image DVD amd64', 'Une image pour une carte ARM'],
        correctIndex: 1,
        explain: 'La machine démarre sur un DVD virtuel. L’architecture est amd64.',
      },
      {
        id: 'a4-q2',
        prompt: 'Quel compte ouvre l’installeur sur l’image ?',
        choices: ['root / opnsense', 'installer / opnsense', 'admin / admin'],
        correctIndex: 1,
        explain: 'L’image ouvre l’installation avec installer / opnsense. root / opnsense est le compte une fois installé.',
      },
      {
        id: 'a4-q3',
        prompt: 'Quel type de disque choisis-tu ?',
        choices: ['ZFS stripe sur le disque virtuel', 'Un RAID matériel de l’hôte', 'Un deuxième disque physique'],
        correctIndex: 0,
        explain: 'Il n’y a qu’un disque virtuel. ZFS stripe est le choix de l’atelier.',
      },
    ],
  },
  {
    id: 'adresses-wan-et-lan',
    code: 'A5',
    title: 'A5 — Adresses WAN et LAN',
    part: 'A',
    duration: '1 h',
    summary:
      'Tu poses le WAN fixe 192.168.5.2/24 et le LAN 192.168.10.1/24. Il n’y a pas encore de VLAN.',
    objectives: [
      'Assigner la première carte au WAN et la carte LAN au LAN',
      'Poser une adresse fixe sur le WAN, avec la passerelle de l’hôte',
      'Poser le LAN 192.168.10.1/24 et son DHCP',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'Tu es sur la console d’OPNsense, dans la fenêtre Hyper-V. Le menu texte suffit. L’interface web n’est pas encore ouverte depuis l’hôte.',
          'Sur Hyper-V, les cartes s’appellent souvent hn0 et hn1. hn0 est en général la première, donc le WAN sur LAB-NAT. hn1 est la carte LAN sur LAB-PRIVE. Si tu hésites, tu compares avec l’ordre affiché par Get-VMNetworkAdapter.',
          'Le tableau de l’atelier peut parler d’un WAN en DHCP. Ce commutateur interne n’a pas de serveur DHCP. Une demande DHCP ne recevrait pas de réponse. Tu poses donc une adresse fixe.',
        ],
        schema:
          'Hôte Hyper-V    192.168.5.1/24     vEthernet (LAB-NAT)\nOPNsense WAN    192.168.5.2/24     passerelle 192.168.5.1\nDNS public      1.1.1.1 ou 9.9.9.9\nOPNsense LAN    192.168.10.1/24    sans VLAN\nDHCP LAN        192.168.10.100 à 192.168.10.200',
        callout: {
          type: 'rule',
          text: 'Le WAN est 192.168.5.2/24, passerelle 192.168.5.1. Le LAN est 192.168.10.1/24. Tu ne crées pas de VLAN dans ce chapitre.',
        },
      },
      {
        title: 'Dans le menu console',
        paragraphs: [
          'Option 1, tu assignes les interfaces. Le WAN est la carte de LAB-NAT. Le LAN est la carte de LAB-PRIVE. Tu ne configures pas d’autre interface.',
          'Option 2, sur le WAN : adresse IPv4 statique 192.168.5.2, masque 24, passerelle 192.168.5.1. Le DNS est 1.1.1.1 ou 9.9.9.9. Tu ne lances pas de serveur DHCP sur le WAN.',
          'Option 2, sur le LAN : adresse 192.168.10.1, masque 24. Tu n’indiques pas de passerelle en amont sur le LAN. Tu actives le DHCP de 192.168.10.100 à 192.168.10.200.',
        ],
      },
    ],
    vigilance: [
      'Le menu montre le WAN en 192.168.5.2/24.',
      'Le menu montre le LAN en 192.168.10.1/24.',
      'Aucune interface VLAN n’est assignée.',
    ],
    deliverable: 'Les deux adresses sont en place, le DHCP du LAN est armé, et les VLAN n’existent pas encore.',
    resources: 'Manuel OPNsense des interfaces.',
    resourceFiles: [
      { label: 'Interfaces OPNsense', url: 'https://docs.opnsense.org/manual/interfaces.html' },
    ],
    commands: [
      'Get-VMNetworkAdapter -VMName "LAB-FW-OPN-01"',
    ],
    checklist: [
      { id: 'a5-assign', label: 'WAN = carte LAB-NAT, LAN = carte LAB-PRIVE.' },
      { id: 'a5-wan', label: 'WAN fixe 192.168.5.2/24, passerelle 192.168.5.1, DNS public.' },
      { id: 'a5-lan', label: 'LAN 192.168.10.1/24, DHCP de .100 à .200.' },
      { id: 'a5-novlan', label: 'Je n’ai pas créé de VLAN.' },
    ],
    quiz: [
      {
        id: 'a5-q1',
        prompt: 'Pourquoi le WAN n’est-il pas en DHCP ?',
        choices: [
          'OPNsense refuse toute adresse fixe',
          'LAB-NAT n’a pas de serveur DHCP, une demande resterait sans réponse',
          'Le DHCP du LAN répond aussi sur le WAN',
        ],
        correctIndex: 1,
        explain: 'New-NetNat traduit les adresses. Il n’offre pas de bail. Le WAN est donc fixe.',
      },
      {
        id: 'a5-q2',
        prompt: 'Quelle est l’adresse du LAN ?',
        choices: ['192.168.10.1/24', '192.168.5.1/24', '192.168.110.1/24'],
        correctIndex: 0,
        explain: '192.168.10.1/24 est le LAN, sans tag. Les VLAN 110 et 120 viendront plus tard.',
      },
      {
        id: 'a5-q3',
        prompt: 'Quelle est la passerelle du WAN ?',
        choices: ['192.168.10.1', '192.168.5.2', '192.168.5.1'],
        correctIndex: 2,
        explain: 'La passerelle du WAN est l’hôte, 192.168.5.1.',
      },
    ],
  },
  {
    id: 'pare-feu-interface-web-depuis-le-wan',
    code: 'A6',
    title: 'A6 — Pare-feu : interface web depuis le WAN',
    part: 'A',
    duration: '1 h 30',
    summary:
      'Le PC physique ouvre l’interface web par le WAN. OPNsense bloque cette voie tant que tu n’as pas ajouté une règle.',
    objectives: [
      'Comprendre que l’anti-verrouillage ne couvre que le LAN',
      'Autoriser le TCP 443 et le TCP 80 depuis 192.168.5.0/24 vers le pare-feu',
      'Ouvrir https://192.168.5.2 depuis l’hôte',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'L’hôte est sur 192.168.5.0/24. Il n’a pas de carte sur LAB-PRIVE. Il ne peut donc pas ouvrir https://192.168.10.1. Son seul chemin est le WAN, https://192.168.5.2.',
          'OPNsense refuse l’administration sur le WAN. La règle d’anti-verrouillage est sur le LAN seulement. Elle ne t’ouvre pas la porte depuis l’hôte.',
          'Le WAN bloque aussi les réseaux privés. 192.168.5.0/24 en fait partie. Tu décoches « Bloquer les réseaux privés » et « Bloquer les réseaux bogons » sur l’interface WAN.',
          'Pour entrer la première fois, tu ouvres le shell (option 8 de la console) et tu tapes pfctl -d. Le filtre est alors éteint. Tu ouvres https://192.168.5.2, tu acceptes le certificat, tu te connectes avec root. Tu enregistres les règles. Puis tu tapes pfctl -e. Tu ne laisses pas le filtre éteint.',
        ],
        callout: {
          type: 'warn',
          text: 'pfctl -d est temporaire. Dès que les règles sont appliquées, pfctl -e rallume le filtre. Un redémarrage le rallume aussi.',
        },
      },
      {
        title: 'La règle à créer',
        paragraphs: [
          'Dans Pare-feu, Règles, WAN, tu ajoutes deux règles de passage. Action : passer. Interface : WAN. Protocole : TCP. Source : 192.168.5.0/24. Destination : Ce pare-feu. Ports de destination : HTTPS, puis la même règle pour HTTP. Tu ne choisis pas de passerelle sur la règle. La passerelle reste celle par défaut.',
          'Tu appliques les changements. Ensuite, depuis l’hôte, Test-NetConnection vérifie le port 443. Get-NetNeighbor montre que 192.168.5.2 est connu sur la carte du LAB-NAT.',
        ],
      },
    ],
    vigilance: [
      'Le navigateur de l’hôte ouvre https://192.168.5.2 et la page de connexion OPNsense.',
      'Test-NetConnection 192.168.5.2 -Port 443 répond TcpTestSucceeded True.',
      'Après pfctl -e, la page s’ouvre encore. La règle permanente fait le travail, pas le filtre éteint.',
    ],
    deliverable: 'L’hôte ouvre l’interface web en HTTPS sur 192.168.5.2, filtre allumé.',
    resources: 'Manuel du pare-feu OPNsense et page de dépannage de l’interface web.',
    resourceFiles: [
      { label: 'Règles de pare-feu', url: 'https://docs.opnsense.org/manual/firewall.html' },
      { label: 'Accès à l’interface web', url: 'https://docs.opnsense.org/troubleshooting/webgui.html' },
    ],
    commands: [
      'Test-NetConnection 192.168.5.2 -Port 443',
      'Get-NetNeighbor -IPAddress 192.168.5.2',
    ],
    checklist: [
      { id: 'a6-private', label: 'J’ai décoché le blocage des réseaux privés et des bogons sur le WAN.' },
      { id: 'a6-rules', label: 'Deux règles WAN laissent passer le TCP 443 et le TCP 80 depuis 192.168.5.0/24 vers Ce pare-feu.' },
      { id: 'a6-pf', label: 'J’ai rallumé le filtre avec pfctl -e.' },
      { id: 'a6-browser', label: 'Le navigateur de l’hôte ouvre https://192.168.5.2.' },
    ],
    quiz: [
      {
        id: 'a6-q1',
        prompt: 'Pourquoi l’anti-verrouillage ne suffit-il pas à l’hôte ?',
        choices: [
          'Il est désactivé sur toutes les interfaces',
          'Il couvre le LAN, et l’hôte n’est pas sur le LAN',
          'Il ouvre seulement le port 3389',
        ],
        correctIndex: 1,
        explain: 'L’anti-verrouillage est sur le LAN. L’hôte arrive par le WAN.',
      },
      {
        id: 'a6-q2',
        prompt: 'Quelle source autorises-tu vers Ce pare-feu ?',
        choices: ['Tout Internet', '192.168.5.0/24', '192.168.10.0/24 seulement'],
        correctIndex: 1,
        explain: 'Seuls les postes du réseau WAN de l’atelier, 192.168.5.0/24, ouvrent l’interface.',
      },
      {
        id: 'a6-q3',
        prompt: 'Que fais-tu juste après avoir appliqué les règles ?',
        choices: ['Tu laisses pfctl -d jusqu’à la fin de l’atelier', 'Tu tapes pfctl -e', 'Tu supprimes la carte LAN'],
        correctIndex: 1,
        explain: 'Le filtre doit être rallumé. La règle permanente garde l’accès.',
      },
    ],
  },
  {
    id: 'windows-11-sans-vlan-et-redirection-rdp',
    code: 'A7',
    title: 'A7 — Windows 11 sans VLAN et redirection RDP',
    part: 'A',
    duration: '2 h',
    summary:
      'Tu installes Windows 11 sur LAB-PRIVE, sans VLAN. Le WAN redirige le TCP 3389 vers l’adresse DHCP de cette machine.',
    objectives: [
      'Créer LAB-PC-WIN-01 en génération 2 sur LAB-PRIVE',
      'Garder le démarrage sécurisé et le TPM allumés',
      'Recevoir une adresse du DHCP 192.168.10.0/24',
      'Rediriger le port WAN 3389 vers cette adresse',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'Le client s’appelle LAB-PC-WIN-01. Il n’a qu’une carte, sur LAB-PRIVE. Tu ne règles pas de VLAN. La carte reste sans tag et reçoit une adresse du LAN, entre 192.168.10.100 et 192.168.10.200.',
          'Windows 11 a besoin du démarrage sécurisé et du TPM. Tu les laisses allumés. L’édition est Windows 11 Pro : l’édition Famille ne peut pas recevoir une session Bureau à distance.',
          'Tu utilises l’image ISO de Windows 11 fournie par le lab, ou celle du site Microsoft. Tu la branches comme le DVD d’OPNsense. Dans la commande, tu remplaces le chemin par le nom réel du fichier. Les deux lignes du lecteur se lancent dans la même fenêtre.',
          'Dans la machine, tu actives le Bureau à distance. ipconfig te donne l’adresse IPv4. Tu la notes. Tu ne lui imposes pas une adresse fixe.',
          'Dans OPNsense : Pare-feu, NAT, Redirection de port. Interface WAN, TCP, port de destination 3389, cible l’adresse notée, port 3389. Tu ajoutes la règle de filtrage associée. Tu n’inventes pas une autre adresse.',
        ],
        callout: {
          type: 'info',
          text: 'Les VLAN ne sont pas configurés. Cette machine reste sur le LAN 192.168.10.0/24 jusqu’au chapitre des ports Hyper-V.',
        },
      },
    ],
    vigilance: [
      'ipconfig dans Windows montre une adresse 192.168.10.100–200, passerelle 192.168.10.1.',
      'La redirection NAT du WAN pointe vers cette adresse, port 3389.',
      'Depuis l’hôte, Test-NetConnection 192.168.5.2 -Port 3389 répond TcpTestSucceeded True.',
      'Get-VMNetworkAdapterVlan ne montre pas de VLAN sur LAB-PC-WIN-01.',
    ],
    deliverable: 'Windows 11 est sur le LAN sans VLAN, et le port 3389 du WAN arrive sur son adresse DHCP.',
    resources: 'Documentation Hyper-V, page Microsoft de Windows 11, et le NAT OPNsense.',
    resourceFiles: [
      { label: 'New-VM', url: 'https://learn.microsoft.com/powershell/module/hyper-v/new-vm' },
      { label: 'Windows 11', url: 'https://www.microsoft.com/software-download/windows11' },
      { label: 'NAT OPNsense', url: 'https://docs.opnsense.org/manual/nat.html' },
    ],
    commands: [
      'New-Item -ItemType Directory -Force -Path "C:\\VMs\\LAB-PC-WIN-01"',
      'New-VM -Name "LAB-PC-WIN-01" -MemoryStartupBytes 4GB -Generation 2 -SwitchName "LAB-PRIVE" -NewVHDPath "C:\\VMs\\LAB-PC-WIN-01\\disque.vhdx" -NewVHDSizeBytes 64GB',
      'Set-VMKeyProtector -VMName "LAB-PC-WIN-01" -NewLocalKeyProtector',
      'Enable-VMTPM -VMName "LAB-PC-WIN-01"',
      'Add-VMDvdDrive -VMName "LAB-PC-WIN-01" -Path "C:\\ISO\\Windows11.iso"',
      '$dvd = Get-VMDvdDrive -VMName "LAB-PC-WIN-01"',
      'Set-VMFirmware -VMName "LAB-PC-WIN-01" -FirstBootDevice $dvd',
      'Test-NetConnection 192.168.5.2 -Port 3389',
    ],
    checklist: [
      { id: 'a7-vm', label: 'LAB-PC-WIN-01 est sur LAB-PRIVE, génération 2, démarrage sécurisé et TPM allumés.' },
      { id: 'a7-dhcp', label: 'Windows a reçu une adresse DHCP du LAN et je l’ai notée.' },
      { id: 'a7-rdp', label: 'Le Bureau à distance est activé dans Windows.' },
      { id: 'a7-nat', label: 'Le WAN redirige le TCP 3389 vers cette adresse, avec la règle de filtrage associée.' },
    ],
    quiz: [
      {
        id: 'a7-q1',
        prompt: 'Où est branchée LAB-PC-WIN-01 dans ce chapitre ?',
        choices: ['LAB-NAT, avec un VLAN', 'LAB-PRIVE, sans VLAN', 'Le Default Switch'],
        correctIndex: 1,
        explain: 'Le client est sur le commutateur privé, sans tag, tant que les VLAN ne sont pas en place.',
      },
      {
        id: 'a7-q2',
        prompt: 'Vers quelle adresse part le port 3389 ?',
        choices: [
          '192.168.5.1, l’hôte',
          'L’adresse DHCP notée dans la machine Windows',
          '192.168.10.1, le pare-feu',
        ],
        correctIndex: 1,
        explain: 'La cible est l’adresse que le DHCP a donnée à Windows. Tu ne l’inventes pas.',
      },
      {
        id: 'a7-q3',
        prompt: 'Pourquoi l’édition Pro ?',
        choices: [
          'L’édition Famille ne reçoit pas le Bureau à distance',
          'OPNsense refuse l’édition Pro',
          'Le TPM n’existe que sur Famille',
        ],
        correctIndex: 0,
        explain: 'Le service Bureau à distance de Windows 11 est disponible sur Pro, pas sur Famille.',
      },
    ],
  },
  {
    id: 'vlan-10-et-20-sur-opnsense',
    code: 'A8',
    title: 'A8 — VLAN 10 et 20 sur OPNsense',
    part: 'A',
    duration: '2 h',
    summary:
      'Tu crées les VLAN 10 et 20 sur OPNsense, avec leur adresse et leur DHCP. La deuxième machine reste sur LAB-PRIVE, sans tag.',
    objectives: [
      'Créer le VLAN 10 en 192.168.110.0/24 et le VLAN 20 en 192.168.120.0/24',
      'Copier les règles du LAN, puis refuser le trafic entre les deux VLAN',
      'Créer LAB-PC-LX-01 sans changer encore les VLAN Hyper-V',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'Les VLAN se créent d’abord sur OPNsense. Le parent est l’interface LAN, celle de LAB-PRIVE. Le LAN sans tag, 192.168.10.1/24, reste en place.',
          'Menu Interfaces, Périphériques, VLAN. Sur une version plus ancienne, le menu s’appelle Autres types, VLAN. Tu ajoutes le tag 10, puis le tag 20.',
          'Tu assignes ces deux périphériques. Tu les actives. VLAN 10 : 192.168.110.1/24. VLAN 20 : 192.168.120.1/24. DHCP : 192.168.110.100 à 192.168.110.200, et 192.168.120.100 à 192.168.120.200. Le menu s’appelle Kea DHCP, ou ISC DHCPv4 si c’est celui que tu vois.',
          'Tu copies sur chaque VLAN les règles du LAN qui laissent sortir vers Internet. Au-dessus, tu refuses le trafic de VLAN 10 vers le réseau VLAN 20, et de VLAN 20 vers le réseau VLAN 10. La première règle qui correspond gagne. Si le refus est en dessous d’un « tout passer », les deux VLAN se parlent.',
          'Tu crées aussi la deuxième machine, LAB-PC-LX-01, Debian ou un second Windows. Elle est sur LAB-PRIVE. Tu ne changes pas encore le VLAN des cartes Hyper-V.',
        ],
        schema:
          'LAN sans tag   192.168.10.0/24      passerelle 192.168.10.1\nVLAN 10        192.168.110.0/24     passerelle 192.168.110.1\nVLAN 20        192.168.120.0/24     passerelle 192.168.120.1\nDHCP           .100 à .200 sur chaque réseau',
        callout: {
          type: 'rule',
          text: 'Tu ne changes pas encore le VLAN des cartes Hyper-V. Les machines restent sans tag jusqu’au chapitre suivant.',
        },
      },
    ],
    vigilance: [
      'Les interfaces VLAN 10 et VLAN 20 sont actives, avec .1/24.',
      'Chaque VLAN a un DHCP .100–.200.',
      'Une règle de refus entre les deux VLAN est au-dessus de la règle de sortie.',
      'Get-VMNetworkAdapterVlan ne montre encore aucun VLAN sur les machines.',
      'LAB-PC-LX-01 existe et sa carte est sur LAB-PRIVE.',
    ],
    deliverable: 'Les deux VLAN existent sur OPNsense. La deuxième machine est créée. Aucune carte Hyper-V n’a encore de VLAN.',
    resources: 'Manuels OPNsense des interfaces, du DHCP et du pare-feu.',
    resourceFiles: [
      { label: 'Interfaces OPNsense', url: 'https://docs.opnsense.org/manual/interfaces.html' },
      { label: 'DHCP OPNsense', url: 'https://docs.opnsense.org/manual/dhcp.html' },
      { label: 'Règles de pare-feu', url: 'https://docs.opnsense.org/manual/firewall.html' },
    ],
    commands: [
      'New-Item -ItemType Directory -Force -Path "C:\\VMs\\LAB-PC-LX-01"',
      'New-VM -Name "LAB-PC-LX-01" -MemoryStartupBytes 2GB -Generation 2 -SwitchName "LAB-PRIVE" -NewVHDPath "C:\\VMs\\LAB-PC-LX-01\\disque.vhdx" -NewVHDSizeBytes 20GB',
      'Get-VMNetworkAdapterVlan -VMName "LAB-FW-OPN-01"',
      'Get-VMNetworkAdapterVlan -VMName "LAB-PC-WIN-01"',
    ],
    checklist: [
      { id: 'a8-vlan10', label: 'VLAN 10 : 192.168.110.1/24 et DHCP .100–.200, parent LAN.' },
      { id: 'a8-vlan20', label: 'VLAN 20 : 192.168.120.1/24 et DHCP .100–.200, parent LAN.' },
      { id: 'a8-rules', label: 'Les règles de sortie sont copiées, et le refus entre les deux VLAN est au-dessus.' },
      { id: 'a8-vm', label: 'LAB-PC-LX-01 est créée sur LAB-PRIVE.' },
      { id: 'a8-wait', label: 'Je n’ai pas encore changé le VLAN des cartes Hyper-V.' },
    ],
    quiz: [
      {
        id: 'a8-q1',
        prompt: 'Quel est le parent des VLAN ?',
        choices: ['La carte WAN, sur LAB-NAT', 'L’interface LAN, sur LAB-PRIVE', 'La carte de l’hôte vEthernet (LAB-NAT)'],
        correctIndex: 1,
        explain: 'Les tags 10 et 20 sont portés par le LAN. Le WAN ne porte pas ces VLAN.',
      },
      {
        id: 'a8-q2',
        prompt: 'Où places-tu la règle qui refuse VLAN 10 vers VLAN 20 ?',
        choices: [
          'Sous la règle qui laisse tout passer',
          'Au-dessus de la règle qui laisse tout passer',
          'Sur le WAN, à la place de la règle HTTPS',
        ],
        correctIndex: 1,
        explain: 'La première règle qui correspond est appliquée. Le refus doit être lu avant le passage.',
      },
      {
        id: 'a8-q3',
        prompt: 'Que fais-tu des cartes Hyper-V dans ce chapitre ?',
        choices: [
          'Tu mets Windows en accès VLAN 10',
          'Tu mets le LAN d’OPNsense en trunk',
          'Tu ne changes pas encore leur VLAN',
        ],
        correctIndex: 2,
        explain: 'Les VLAN existent d’abord sur OPNsense. Les ports Hyper-V changent au chapitre suivant.',
      },
    ],
  },
  {
    id: 'ports-hyper-v-en-trunk-et-en-acces',
    code: 'A9',
    title: 'A9 — Ports Hyper-V en trunk et en accès',
    part: 'A',
    duration: '1 h 30',
    summary:
      'Les VLAN sont déjà sur OPNsense. Tu règles maintenant le trunk et les accès sur l’hôte, puis tu mets à jour la redirection RDP.',
    objectives: [
      'Mettre la carte LAN d’OPNsense en trunk pour les VLAN 10 et 20',
      'Mettre Windows en accès VLAN 10 et la deuxième machine en accès VLAN 20',
      'Pointer la redirection 3389 vers la nouvelle adresse de Windows',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'Cet atelier n’a pas de commutateur physique. Tu règles le VLAN sur l’hôte Hyper-V.',
          'La carte LAN de LAB-FW-OPN-01 devient un trunk. Elle transporte les VLAN 10 et 20, et elle laisse passer le LAN sans tag. NativeVlanId 0 veut dire : le trafic sans tag reste sans tag.',
          'LAB-PC-WIN-01 passe en accès VLAN 10. LAB-PC-LX-01 passe en accès VLAN 20. Un port d’accès n’utilise qu’un seul VLAN.',
          'Windows perd son adresse 192.168.10.x. Il reçoit une adresse du DHCP VLAN 10, dans 192.168.110.100–200. Tu la notes. Dans la redirection du port 3389, tu remplaces l’ancienne cible par cette nouvelle adresse. Tu ne lui imposes pas une adresse fixe.',
        ],
        callout: {
          type: 'info',
          text: 'Le trunk vise la carte nommée LAN. Sans ce nom, la commande peut aussi toucher la carte WAN. Le WAN ne doit pas devenir un trunk.',
        },
      },
    ],
    vigilance: [
      'Get-VMNetworkAdapterVlan montre le trunk 10,20 et NativeVlanId 0 sur la carte LAN d’OPNsense.',
      'Windows est en accès VLAN 10 et a une adresse 192.168.110.x.',
      'La deuxième machine est en accès VLAN 20 et a une adresse 192.168.120.x.',
      'La redirection 3389 vise la nouvelle adresse de Windows.',
    ],
    deliverable: 'Le trunk et les deux accès sont en place, et le RDP du WAN vise l’adresse VLAN 10 de Windows.',
    resources: 'Documentation Microsoft de Set-VMNetworkAdapterVlan.',
    resourceFiles: [
      {
        label: 'Set-VMNetworkAdapterVlan',
        url: 'https://learn.microsoft.com/powershell/module/hyper-v/set-vmnetworkadaptervlan',
      },
    ],
    commands: [
      'Set-VMNetworkAdapterVlan -VMName "LAB-FW-OPN-01" -VMNetworkAdapterName "LAN" -Trunk -AllowedVlanIdList "10,20" -NativeVlanId 0',
      'Set-VMNetworkAdapterVlan -VMName "LAB-PC-WIN-01" -VMNetworkAdapterName "Network Adapter" -Access -VlanId 10',
      'Set-VMNetworkAdapterVlan -VMName "LAB-PC-LX-01" -VMNetworkAdapterName "Network Adapter" -Access -VlanId 20',
      'Get-VMNetworkAdapterVlan -VMName "LAB-FW-OPN-01"',
      'Get-VMNetworkAdapterVlan -VMName "LAB-PC-WIN-01"',
      'Get-VMNetworkAdapterVlan -VMName "LAB-PC-LX-01"',
    ],
    checklist: [
      { id: 'a9-trunk', label: 'La carte LAN d’OPNsense est en trunk, VLAN 10 et 20, NativeVlanId 0.' },
      { id: 'a9-win', label: 'LAB-PC-WIN-01 est en accès VLAN 10 et j’ai noté sa nouvelle adresse DHCP.' },
      { id: 'a9-lx', label: 'LAB-PC-LX-01 est en accès VLAN 20.' },
      { id: 'a9-rdp', label: 'La redirection TCP 3389 vise la nouvelle adresse de Windows.' },
    ],
    quiz: [
      {
        id: 'a9-q1',
        prompt: 'Où règles-tu le VLAN des machines ?',
        choices: [
          'Sur un commutateur physique',
          'Sur l’hôte Hyper-V',
          'Dans le DHCP de l’hôte',
        ],
        correctIndex: 1,
        explain: 'Cet atelier n’a pas de commutateur physique. Le VLAN se règle avec Set-VMNetworkAdapterVlan.',
      },
      {
        id: 'a9-q2',
        prompt: 'Que veut dire NativeVlanId 0 sur le trunk ?',
        choices: [
          'Le LAN sans tag est interdit',
          'Le trafic sans tag reste sans tag',
          'Seul le VLAN 10 passe',
        ],
        correctIndex: 1,
        explain: '0 laisse le LAN d’origine sans tag, pendant que 10 et 20 passent avec leur tag.',
      },
      {
        id: 'a9-q3',
        prompt: 'Quelle machine est en accès VLAN 20 ?',
        choices: ['LAB-FW-OPN-01', 'LAB-PC-WIN-01', 'LAB-PC-LX-01'],
        correctIndex: 2,
        explain: 'Windows est en VLAN 10. La deuxième machine est en VLAN 20. OPNsense est le trunk.',
      },
    ],
  },
  {
    id: 'verifier-l-isolation-et-internet',
    code: 'A10',
    title: 'A10 — Vérifier l’isolation et Internet',
    part: 'A',
    duration: '1 h',
    summary:
      'Les deux clients sont sur le même commutateur, mais pas dans le même VLAN. Tu vérifies qu’ils ne se parlent pas, que chacun sort sur Internet, et que l’hôte ouvre encore l’interface web.',
    objectives: [
      'Montrer que Windows et la deuxième machine ne se joignent pas',
      'Montrer que chacun sort sur Internet en passant par OPNsense',
      'Montrer que le PC physique ouvre encore https://192.168.5.2',
    ],
    sections: [
      {
        title: 'Introduction',
        paragraphs: [
          'Les deux clients sont branchés sur LAB-PRIVE. Ils ne se voient pas : l’un est en VLAN 10, l’autre en VLAN 20. Leurs trames ne se mélangent pas.',
          'Même si une trame arrivait au pare-feu, la règle du chapitre précédent refuse le passage d’un VLAN à l’autre.',
          'Chaque client sort pourtant sur Internet. Son chemin est : sa passerelle .1, puis OPNsense, puis le WAN 192.168.5.2, puis le NAT de l’hôte. Il y a deux traductions. C’est le plan de l’atelier.',
          'Le PC physique n’est pas dans ces VLAN. Il ouvre toujours l’interface web par le WAN, https://192.168.5.2.',
        ],
        callout: {
          type: 'info',
          text: 'Une absence de réponse au ping entre les deux machines est le résultat attendu. Une page web qui s’ouvre depuis chaque machine est l’autre résultat attendu.',
        },
      },
    ],
    vigilance: [
      'Depuis Windows, l’adresse 192.168.120.x de l’autre machine ne répond pas.',
      'Depuis la deuxième machine, l’adresse 192.168.110.x de Windows ne répond pas.',
      'Chaque machine ouvre une page web, ou joint 1.1.1.1.',
      'Le navigateur de l’hôte ouvre encore https://192.168.5.2.',
    ],
    deliverable: 'Les trois preuves sont notées : isolation, Internet pour chaque client, interface web depuis l’hôte.',
    resources: 'Manuels OPNsense du pare-feu et du NAT, pour relire le chemin.',
    resourceFiles: [
      { label: 'Règles de pare-feu', url: 'https://docs.opnsense.org/manual/firewall.html' },
      { label: 'NAT OPNsense', url: 'https://docs.opnsense.org/manual/nat.html' },
    ],
    commands: [
      'Test-NetConnection 192.168.5.2 -Port 443',
      'Get-VMNetworkAdapterVlan',
    ],
    checklist: [
      { id: 'a10-isol', label: 'Les deux machines ne se répondent pas.' },
      { id: 'a10-inet-win', label: 'Windows sort sur Internet.' },
      { id: 'a10-inet-lx', label: 'La deuxième machine sort sur Internet.' },
      { id: 'a10-wan', label: 'Le PC physique ouvre encore https://192.168.5.2.' },
    ],
    quiz: [
      {
        id: 'a10-q1',
        prompt: 'Pourquoi les deux clients ne se parlent-ils pas ?',
        choices: [
          'Ils sont sur deux commutateurs physiques différents',
          'Ils sont sur LAB-PRIVE, mais dans deux VLAN, et le pare-feu refuse l’autre chemin',
          'OPNsense éteint le NAT de l’hôte',
        ],
        correctIndex: 1,
        explain: 'Même commutateur virtuel, VLAN différents. Le pare-feu ne fait pas passer l’un vers l’autre.',
      },
      {
        id: 'a10-q2',
        prompt: 'Par où une machine du VLAN 10 rejoint-elle Internet ?',
        choices: [
          'Directement par le Default Switch',
          'Par OPNsense, puis par le NAT de l’hôte',
          'Par le PC physique, sans pare-feu',
        ],
        correctIndex: 1,
        explain: 'OPNsense traduit vers 192.168.5.2. L’hôte traduit ensuite 192.168.5.0/24 vers Internet.',
      },
      {
        id: 'a10-q3',
        prompt: 'Comment le PC physique ouvre-t-il encore l’interface web ?',
        choices: ['Par le LAN 192.168.10.1', 'Par le WAN https://192.168.5.2', 'Par le VLAN 20'],
        correctIndex: 1,
        explain: 'L’hôte n’est pas sur LAB-PRIVE. Son accès reste le WAN, 192.168.5.2.',
      },
    ],
  },
];
