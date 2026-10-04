import { extractChapterCode } from '../chapter-id';

export interface MilestoneDef {
  code: string;
  shortTitle: string;
  recap: string;
}

/** Jalons : adresses posées (A5), puis atelier vérifié (A10). */
export const MILESTONES: MilestoneDef[] = [
  {
    code: 'A5',
    shortTitle: 'Jalon adresses',
    recap:
      'LAB-NAT, LAB-PRIVE et OPNsense sont en place. Le WAN est 192.168.5.2/24 et le LAN est 192.168.10.1/24. Les VLAN ne sont pas encore créés.',
  },
  {
    code: 'A10',
    shortTitle: 'Jalon atelier',
    recap:
      'Les deux clients sont isolés (VLAN 10 et VLAN 20), chacun sort sur Internet, et le PC physique ouvre encore l’interface web par le WAN.',
  },
];

export function milestoneByCode(code: string | undefined): MilestoneDef | undefined {
  if (!code) {
    return undefined;
  }
  return MILESTONES.find((item) => item.code.toUpperCase() === code.toUpperCase());
}

export function milestoneFromTitleOrId(title: string, id: string): MilestoneDef | undefined {
  return milestoneByCode(extractChapterCode(title) ?? extractChapterCode(id));
}

export function hubMilestoneDef(code: string | undefined): MilestoneDef {
  const known = milestoneByCode(code);
  if (known) {
    return known;
  }
  return {
    code: (code ?? '').trim().toUpperCase() || 'J',
    shortTitle: 'Jalon',
    recap: 'Étape marquée dans le parcours Loutravo.',
  };
}
