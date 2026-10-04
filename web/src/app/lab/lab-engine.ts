/**
 * Moteur de simulation de shell — prévu, pas branché sur les chapitres en v1.
 * Isolé de l'UI pour pouvoir brancher xterm.js plus tard sans réécrire le parcours.
 */
export interface LabCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface LabEngine {
  readonly hostname: string;
  exec(line: string): LabCommandResult;
}

export function createLabEngine(hostname = 'LAB-PC-CLI-01'): LabEngine {
  return {
    hostname,
    exec(): LabCommandResult {
      return {
        stdout: '',
        stderr:
          'Simulateur de shell : prévue dans une prochaine version. Utilise le matériel réel (Partie A) ou tes VM (Partie B).',
        exitCode: 1,
      };
    },
  };
}
