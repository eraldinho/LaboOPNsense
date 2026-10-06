import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LaunchSession,
  LoutravoError,
  LoutravoErrorBody,
  ProgressResponse,
  SessionSnapshot,
} from './loutravo.types';

export const ACTIVITY_CONTENT_MAX_MARKDOWN = 200_000;
export const ACTIVITY_CONTENT_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ACTIVITY_CONTENT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACTIVITY_CONTENT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,.md,.json,application/pdf';
export const PARCOURS_INTRO_CHAPTER_ID = 'parcours-intro';
const LOCAL_OVERRIDE_PREFIX = 'loutravo.content.';
const LOCAL_DIRTY_KEY = 'loutravo.content.dirty';

export interface ActivityContentChapter {
  markdown: string;
  updatedAt?: number;
  updatedBy?: string;
}

@Injectable({ providedIn: 'root' })
export class LoutravoApi {
  private readonly http = inject(HttpClient);
  private readonly hub = environment.loutravoHub;

  redeemLaunch(code: string): Promise<LaunchSession> {
    return this.post('/redeemLaunch', { code });
  }

  reportProgress(
    sessionToken: string,
    chapterId: string,
    status: 'started' | 'completed',
  ): Promise<ProgressResponse> {
    return this.post('/reportProgress', { sessionToken, chapterId, status });
  }

  getSession(sessionToken: string): Promise<SessionSnapshot> {
    return this.post('/getSession', { sessionToken });
  }

  reportTestDraft(sessionToken: string, draft: unknown): Promise<{ ok: boolean }> {
    return this.post('/reportTestDraft', { sessionToken, draft });
  }

  reportSignal(payload: {
    sessionToken: string;
    chapterId: string;
    kind: 'link' | 'check';
    label: string;
    href?: string;
    checked?: boolean;
    order?: number;
  }): Promise<{ ok: boolean }> {
    return this.post('/reportSignal', payload);
  }

  reportActivityBug(payload: {
    sessionToken: string;
    message: string;
    pageLabel: string;
    pageUrl: string;
    chapterId?: string;
  }): Promise<{ ok: boolean }> {
    return this.post('/reportActivityBug', payload);
  }

  async getActivityContent(
    appId: string,
    sessionToken?: string,
  ): Promise<Record<string, string>> {
    const body = sessionToken ? { sessionToken, appId } : { appId };
    const data = await this.post<{ chapters?: Record<string, ActivityContentChapter> }>(
      '/getActivityContent',
      body,
    );
    const chapters = data.chapters && typeof data.chapters === 'object' ? data.chapters : {};
    const out: Record<string, string> = {};
    for (const [id, row] of Object.entries(chapters)) {
      if (row && typeof row.markdown === 'string') {
        out[id] = row.markdown;
      }
    }
    return out;
  }

  saveActivityContent(sessionToken: string, chapterId: string, markdown: string): Promise<unknown> {
    if (markdown.length > ACTIVITY_CONTENT_MAX_MARKDOWN) {
      throw new LoutravoError(400, 'INVALID_ARGUMENT', 'Texte trop long.');
    }
    return this.post('/saveActivityContent', { sessionToken, chapterId, markdown });
  }

  async uploadActivityContentImage(
    sessionToken: string,
    chapterId: string,
    file: File,
  ): Promise<{ url: string; markdown?: string; kind?: string }> {
    return this.uploadActivityContentAsset(sessionToken, chapterId, file, {
      endpoint: '/uploadActivityContentImage',
      maxBytes: ACTIVITY_CONTENT_MAX_IMAGE_BYTES,
      tooBig: 'Image trop lourde (max 4 Mo).',
      defaultName: 'image.png',
      defaultType: 'image/png',
    });
  }

  async uploadActivityContentFile(
    sessionToken: string,
    chapterId: string,
    file: File,
  ): Promise<{ url: string; markdown?: string; kind?: string }> {
    return this.uploadActivityContentAsset(sessionToken, chapterId, file, {
      endpoint: '/uploadActivityContentFile',
      maxBytes: ACTIVITY_CONTENT_MAX_FILE_BYTES,
      tooBig: 'Fichier trop lourd (max 20 Mo).',
      defaultName: 'fichier.bin',
      defaultType: file.type || 'application/octet-stream',
    });
  }

  private async uploadActivityContentAsset(
    sessionToken: string,
    chapterId: string,
    file: File,
    opts: {
      endpoint: string;
      maxBytes: number;
      tooBig: string;
      defaultName: string;
      defaultType: string;
    },
  ): Promise<{ url: string; markdown?: string; kind?: string }> {
    if (file.size > opts.maxBytes) {
      throw new LoutravoError(400, 'INVALID_ARGUMENT', opts.tooBig);
    }
    const data = await readFileAsDataUrl(file);
    return this.post(opts.endpoint, {
      sessionToken,
      chapterId,
      filename: file.name || opts.defaultName,
      contentType: file.type || opts.defaultType,
      data,
    });
  }

  async exportActivityPdf(body: Record<string, unknown>): Promise<{ blob: Blob; fileName: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post(this.hub + '/exportActivityPdf', body, {
          observe: 'response',
          responseType: 'blob',
        }),
      );
      const header = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(header);
      return { blob: response.body ?? new Blob(), fileName: match?.[1] || 'loutravo-export.pdf' };
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 0) {
        throw new LoutravoError(
          0,
          'UNAVAILABLE',
          'Impossible de générer le PDF : pas de connexion. Réessaie quand le réseau est disponible.',
        );
      }
      if (err instanceof HttpErrorResponse && (err.status === 408 || err.status === 504)) {
        throw new LoutravoError(
          err.status,
          'DEADLINE_EXCEEDED',
          'La génération a pris trop de temps. Réessaie, ou exporte moins de chapitres.',
        );
      }
      if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
        const text = await err.error.text();
        let message = 'La génération du PDF a échoué. Réessaie.';
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string } };
          if (parsed.error?.message) message = parsed.error.message;
        } catch {
          /* message par défaut */
        }
        throw new LoutravoError(err.status, 'INTERNAL', message);
      }
      throw this.toLoutravoError(err);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.post<T>(this.hub + path, body, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    } catch (err) {
      throw this.toLoutravoError(err);
    }
  }

  private toLoutravoError(err: unknown): LoutravoError {
    if (err instanceof LoutravoError) {
      return err;
    }
    if (err instanceof HttpErrorResponse) {
      const payload = err.error as LoutravoErrorBody | undefined;
      const code = payload?.error?.status ?? 'INTERNAL';
      const message =
        payload?.error?.message ||
        defaultMessage(err.status, code) ||
        err.statusText ||
        'Erreur Loutravo';
      return new LoutravoError(err.status, code, message);
    }
    return new LoutravoError(500, 'INTERNAL', 'Impossible de joindre Loutravo.');
  }
}

export function insertMarkdownImage(markdown: string, url: string, alt = 'image'): string {
  const tag = `![${String(alt).replace(/[[\]]/g, '')}](${String(url).trim()})`;
  return appendMarkdown(markdown, tag);
}

export function insertMarkdownFileLink(markdown: string, url: string, label = 'fichier'): string {
  const safeLabel = String(label).replace(/[[\]]/g, '').trim() || 'fichier';
  const tag = `[Télécharger : ${safeLabel}](${String(url).trim()})`;
  return appendMarkdown(markdown, tag);
}

/** Lien web : texte affiché + URL. Clic élève → nouvelle fenêtre. */
export function markdownLinkTag(url: string, label = ''): string {
  const href = String(url ?? '').trim();
  const safeLabel = String(label ?? '')
    .replace(/[[\]]/g, '')
    .trim() || href;
  return `[${safeLabel}](${href})`;
}

export function insertMarkdownLink(markdown: string, url: string, label = ''): string {
  return appendMarkdown(markdown, markdownLinkTag(url, label));
}

function appendMarkdown(markdown: string, tag: string): string {
  const text = markdown ?? '';
  if (!text.trim()) {
    return `${tag}\n`;
  }
  const glue = text.endsWith('\n') ? '' : '\n';
  return `${text}${glue}${tag}\n`;
}

function parseOverrideStore(raw: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function storageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(LOCAL_OVERRIDE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

export function readLocalOverrides(appId: string): Record<string, string> {
  const key = LOCAL_OVERRIDE_PREFIX + appId;
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    const map = parseOverrideStore(raw);
    if (raw && !localStorage.getItem(key)) {
      localStorage.setItem(key, raw);
    }
    return map;
  } catch {
    return {};
  }
}

/** Tous les calques déjà écrits dans ce navigateur, quel que soit l’appId de séance. */
export function readAllLocalOverrides(): Record<string, string> {
  const maps: Record<string, string>[] = [];
  try {
    for (const key of storageKeys(localStorage)) {
      maps.push(parseOverrideStore(localStorage.getItem(key)));
    }
    for (const key of storageKeys(sessionStorage)) {
      maps.push(parseOverrideStore(sessionStorage.getItem(key)));
    }
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = v;
      }
    }
  }
  return out;
}

export function writeLocalOverrides(appId: string, overrides: Record<string, string>): void {
  const key = LOCAL_OVERRIDE_PREFIX + appId;
  const payload = JSON.stringify(overrides ?? {});
  localStorage.setItem(key, payload);
  sessionStorage.removeItem(key);
}

export function readDirtyChapterIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_DIRTY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function writeDirtyChapterIds(ids: string[]): void {
  localStorage.setItem(LOCAL_DIRTY_KEY, JSON.stringify([...new Set(ids)]));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

function defaultMessage(http: number, code: string): string {
  if (http === 401 || code === 'UNAUTHENTICATED') {
    return 'Session expirée. Relance cette activité depuis Loutravo.';
  }
  if (http === 403) {
    return 'Activité non attribuée ou révoquée. Relance depuis Loutravo.';
  }
  if (http === 404) {
    return 'Code de lancement inconnu. Relance cette activité depuis Loutravo.';
  }
  if (http === 410) {
    return 'Code de lancement expiré. Relance cette activité depuis Loutravo.';
  }
  if (http === 409) {
    return 'Étape refusée (chapitre sauté ou déjà terminé).';
  }
  return '';
}
