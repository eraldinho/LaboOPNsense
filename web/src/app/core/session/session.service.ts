import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { chapterListTitle, resolveChapterCode } from '../content/chapter-id';
import { applyHubTitle, contentPart, emptyChapterContent, findContent } from '../content/chapters';
import { ChapterContent } from '../content/chapter.types';
import { ContentOverridesService } from '../content/content-overrides.service';
import { chapterMilestone } from '../content/bank/groups';
import { MilestoneDef } from '../content/bank/milestones';
import { LoutravoApi } from '../loutravo/loutravo.api';
import { MockLoutravoBackend } from '../loutravo/loutravo.mock';
import { LaunchSession, LoutravoError, ProgressResponse } from '../loutravo/loutravo.types';
import { chapterAccess, isPreviewFlag } from './chapter-access';

const TESTS_POLL_MS = 5_000;

const SESSION_KEY = 'loutravo.session';
const UI_KEY = 'lab-opnsense.ui';
const MOCK_FLAG = 'lab-opnsense.mock';

export interface ChapterView {
  id: string;
  title: string;
  /** Numéro jaune (A0, B1…) — source Loutravo, sinon fiche bundlée. */
  code: string;
  /** Titre blanc, sans le numéro déjà affiché à gauche. */
  displayTitle: string;
  order: number;
  content: ChapterContent | undefined;
  completed: boolean;
  playable: boolean;
  locked: boolean;
  testLocked: boolean;
  part: 'A' | 'B' | undefined;
  hubMilestone?: boolean;
  milestoneTitle?: string;
  milestoneRecap?: string;
  milestone?: MilestoneDef;
}

export interface UiState {
  checklists: Record<string, string[]>;
  quizzes: Record<string, Record<string, number>>;
  quizPassed: Record<string, boolean>;
  started: string[];
}

export interface ProgressView {
  done: number;
  total: number;
  current?: ChapterView;
  finished: boolean;
  /** Libellé court : « 3 / 8 terminés ». */
  countsLabel: string;
  /** Libellé du chapitre jouable, distinct de « terminé ». */
  currentLabel: string;
}

const emptyUi = (): UiState => ({ checklists: {}, quizzes: {}, quizPassed: {}, started: [] });

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(LoutravoApi);
  private readonly contentOverrides = inject(ContentOverridesService);
  private mockApi: MockLoutravoBackend | null = null;
  /** Vrai après un chargement du texte Firestore dans cette page. Un Ctrl+F5 repart de zéro. */
  private contentLoaded = false;

  readonly session = signal<LaunchSession | null>(null);
  readonly mock = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly ui = signal<UiState>(emptyUi());
  private testsPollTimer: ReturnType<typeof setInterval> | null = null;
  private testsPollInFlight = false;
  private readonly onSessionVisible = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    void this.refreshTestsUnlocked();
  };

  constructor() {
    this.restore();
    this.bindTestsPoll();
    this.syncTestsPoll();
  }

  isReady(): boolean {
    const s = this.session();
    return !!s && s.expiresAt > Date.now();
  }

  isMock(): boolean {
    return this.mock();
  }

  isPreview(): boolean {
    return isPreviewFlag(this.session()?.preview);
  }

  async boot(): Promise<'ok' | 'error'> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('launch');
    const previewQuery = params.get('preview') === '1';
    if (code) {
      return this.redeem(code, previewQuery);
    }
    // ?preview=1 sans code sert au mock local. Une séance Loutravo déjà ouverte doit la garder :
    // sinon le rechargement remplace le texte enregistré par le mock.
    if (previewQuery && !(this.isReady() && !this.isMock())) {
      return this.startMock(params.get('chapters'), true);
    }
    if (this.isReady()) {
      if (previewQuery && !this.isPreview()) {
        const current = this.session();
        if (current) {
          this.persistSession({ ...current, preview: true });
        }
      }
      await this.reloadContent();
      return 'ok';
    }
    if (environment.allowMock) {
      return this.startMock(params.get('chapters'), false);
    }
    this.errorMessage.set('Relance cette activité depuis Loutravo.');
    return 'error';
  }

  async report(chapterId: string, status: 'started' | 'completed'): Promise<ProgressResponse> {
    if (this.isPreview()) {
      return {
        ok: true,
        appId: this.session()?.appId ?? 'lab-opnsense',
        chapterId,
        status,
        assignmentStatus: 'assigned',
        currentChapterId: chapterId,
        completedChapterIds: [],
      };
    }
    const s = this.requireSession();
    try {
      const next = this.mock()
        ? this.requireMock().report(s.sessionToken, chapterId, status)
        : await this.api.reportProgress(s.sessionToken, chapterId, status);
      this.applyProgress(next);
      return next;
    } catch (err) {
      this.capture(err);
      throw err;
    }
  }

  reportSignal(input: {
    chapterId: string;
    kind: 'link' | 'check';
    label: string;
    href?: string;
    checked?: boolean;
    order?: number;
  }): void {
    if (this.isPreview() || this.mock()) return;
    const s = this.session();
    if (!s || s.expiresAt <= Date.now()) return;
    const label = input.label.trim();
    if (!label) return;
    void this.api
      .reportSignal({
        sessionToken: s.sessionToken,
        chapterId: input.chapterId,
        kind: input.kind,
        label,
        href: input.href,
        checked: input.checked,
        order: input.order,
      })
      .catch(() => undefined);
  }

  chapters(): ChapterView[] {
    const s = this.session();
    if (!s) {
      return [];
    }
    const access = chapterAccess(s.chapters, s.completedChapterIds, this.isPreview(), s.testsUnlocked === true);
    const accessById = new Map(access.map((a) => [a.id, a]));
    const sorted = [...s.chapters].sort((a, b) => a.order - b.order);
    return sorted.map((ch) => {
      const flags = accessById.get(ch.id) ?? {
        id: ch.id,
        completed: false,
        playable: false,
        locked: true,
        testLocked: false,
      };
      const bundled =
        findContent(ch.id, ch.title) ?? emptyChapterContent({ id: ch.id, title: ch.title, code: ch.code });
      const content = applyHubTitle(this.contentOverrides.apply(ch.id, bundled), ch.title, ch.code);
      const code = resolveChapterCode({
        hubCode: ch.code,
        title: ch.title,
        bundled: content?.code,
        id: ch.id,
        fallback: `#${ch.order + 1}`,
      });
      const view: ChapterView = {
        id: ch.id,
        title: ch.title,
        code,
        displayTitle: chapterListTitle({
          id: ch.id,
          hubTitle: ch.title,
          contentTitle: content?.title,
          code,
        }),
        order: ch.order,
        content,
        completed: flags.completed,
        playable: flags.playable,
        locked: flags.locked,
        testLocked: flags.testLocked,
        part: contentPart(ch.id, ch.title, content),
        hubMilestone: ch.milestone === true,
        milestoneTitle: ch.milestoneTitle,
        milestoneRecap: ch.milestoneRecap,
      };
      view.milestone = chapterMilestone(view);
      return view;
    });
  }

  chapter(id: string): ChapterView | undefined {
    return this.chapters().find((c) => c.id === id);
  }

  progress(): ProgressView {
    const list = this.chapters();
    const done = list.filter((c) => c.completed).length;
    const total = list.length;
    if (this.isPreview()) {
      return {
        done,
        total,
        current: list[0],
        finished: false,
        countsLabel: total === 0 ? 'Aucun chapitre' : `${total} chapitres — aperçu`,
        currentLabel: 'Navigation libre — tous les chapitres sont ouverts',
      };
    }
    const current = list.find((c) => c.playable);
    const waitingTest = list.find((c) => c.testLocked);
    const hubDone = this.session()?.status === 'completed';
    const finished = hubDone || (total > 0 && done === total);
    const currentCode = current?.content?.code ?? current?.title;
    return {
      done,
      total,
      current,
      finished,
      countsLabel: total === 0 ? 'Aucun chapitre attribué' : `${done} / ${total} terminés`,
      currentLabel: finished
        ? 'Tous les chapitres attribués sont terminés'
        : current
          ? `En cours : ${currentCode}`
          : waitingTest
            ? 'Le test suivant est fermé. Le professeur doit le débloquer.'
            : 'Pas encore commencé',
    };
  }

  remainingLabel(): string {
    const s = this.session();
    if (!s) {
      return '';
    }
    const ms = s.expiresAt - Date.now();
    if (ms <= 0) {
      return 'session expirée';
    }
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  assignmentStatus(): LaunchSession['status'] | null {
    return this.session()?.status ?? null;
  }

  toggleCheck(chapterId: string, itemId: string): void {
    const ui = structuredClone(this.ui());
    const list = new Set(ui.checklists[chapterId] ?? []);
    if (list.has(itemId)) {
      list.delete(itemId);
    } else {
      list.add(itemId);
    }
    ui.checklists[chapterId] = [...list];
    this.ui.set(ui);
    this.persistUi();
  }

  isChecked(chapterId: string, itemId: string): boolean {
    return (this.ui().checklists[chapterId] ?? []).includes(itemId);
  }

  setAnswer(chapterId: string, questionId: string, index: number): void {
    const ui = structuredClone(this.ui());
    const quiz = { ...(ui.quizzes[chapterId] ?? {}) };
    quiz[questionId] = index;
    ui.quizzes[chapterId] = quiz;
    ui.quizPassed[chapterId] = false;
    this.ui.set(ui);
    this.persistUi();
  }

  answer(chapterId: string, questionId: string): number | undefined {
    const value = this.ui().quizzes[chapterId]?.[questionId];
    return typeof value === 'number' ? value : undefined;
  }

  setQuizPassed(chapterId: string, passed: boolean): void {
    const ui = structuredClone(this.ui());
    ui.quizPassed[chapterId] = passed;
    this.ui.set(ui);
    this.persistUi();
  }

  quizPassed(chapterId: string): boolean {
    return this.ui().quizPassed[chapterId] === true;
  }

  markStartedLocal(chapterId: string): void {
    const ui = structuredClone(this.ui());
    if (!ui.started.includes(chapterId)) {
      ui.started.push(chapterId);
      this.ui.set(ui);
      this.persistUi();
    }
  }

  hasStartedLocal(chapterId: string): boolean {
    return this.ui().started.includes(chapterId);
  }

  clear(): void {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(UI_KEY);
    sessionStorage.removeItem(MOCK_FLAG);
    this.session.set(null);
    this.mock.set(false);
    this.mockApi = null;
    this.contentLoaded = false;
    this.ui.set(emptyUi());
    this.syncTestsPoll();
  }

  private async redeem(code: string, previewQuery: boolean): Promise<'ok' | 'error'> {
    try {
      const session = await this.api.redeemLaunch(code);
      session.preview = isPreviewFlag(session.preview) || previewQuery;
      this.mock.set(false);
      this.mockApi = null;
      sessionStorage.removeItem(MOCK_FLAG);
      this.persistSession(session);
      const path = window.location.pathname;
      window.history.replaceState({}, '', session.preview ? `${path}?preview=1` : path);
      this.errorMessage.set(null);
      await this.reloadContent();
      return 'ok';
    } catch (err) {
      this.capture(err);
      return 'error';
    }
  }

  private async startMock(chaptersParam: string | null, preview: boolean): Promise<'ok'> {
    const codes = chaptersParam
      ?.split(/[,+\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    this.mockApi = MockLoutravoBackend.fromCodes(codes?.length ? codes : undefined);
    const session = this.mockApi.redeem(preview);
    this.mock.set(true);
    sessionStorage.setItem(MOCK_FLAG, '1');
    this.persistSession(session);
    this.errorMessage.set(null);
    await this.reloadContent();
    return 'ok';
  }

  /** Recharge le texte enregistré. Un chapitre rechargé ne passe pas par la page d’ouverture. */
  async ensureContent(): Promise<void> {
    if (this.contentLoaded || !this.isReady()) {
      return;
    }
    await this.reloadContent();
  }

  private async reloadContent(): Promise<void> {
    const s = this.session();
    if (!s) {
      return;
    }
    await this.contentOverrides.load(s.appId, s.sessionToken);
    this.contentLoaded = true;
  }

  private applyProgress(next: ProgressResponse): void {
    const s = this.requireSession();
    const updated: LaunchSession = {
      ...s,
      completedChapterIds: next.completedChapterIds,
      currentChapterId: next.currentChapterId,
      status: next.assignmentStatus,
    };
    if (typeof next.testsUnlocked === 'boolean') {
      updated.testsUnlocked = next.testsUnlocked;
    }
    this.persistSession(updated);
  }

  private persistSession(session: LaunchSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
    this.syncTestsPoll();
  }

  private bindTestsPoll(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('focus', this.onSessionVisible);
    document.addEventListener('visibilitychange', this.onSessionVisible);
  }

  private shouldPollTests(): boolean {
    const s = this.session();
    if (!s || s.expiresAt <= Date.now() || this.isPreview() || this.mock()) {
      return false;
    }
    if (s.testsUnlocked === true) {
      return false;
    }
    return chapterAccess(s.chapters, s.completedChapterIds, false, false).some((item) => item.testLocked);
  }

  private syncTestsPoll(): void {
    if (this.shouldPollTests()) {
      this.startTestsPoll();
      return;
    }
    this.stopTestsPoll();
  }

  private startTestsPoll(): void {
    if (this.testsPollTimer !== null) {
      return;
    }
    this.testsPollTimer = setInterval(() => {
      void this.refreshTestsUnlocked();
    }, TESTS_POLL_MS);
    void this.refreshTestsUnlocked();
  }

  private stopTestsPoll(): void {
    if (this.testsPollTimer === null) {
      return;
    }
    clearInterval(this.testsPollTimer);
    this.testsPollTimer = null;
  }

  private async refreshTestsUnlocked(): Promise<void> {
    if (this.testsPollInFlight || !this.shouldPollTests()) {
      return;
    }
    const s = this.session();
    if (!s) {
      return;
    }
    this.testsPollInFlight = true;
    try {
      const next = await this.api.getSession(s.sessionToken);
      const current = this.session();
      if (!current || current.sessionToken !== s.sessionToken) {
        return;
      }
      if (next.testsUnlocked === true && current.testsUnlocked !== true) {
        this.persistSession({ ...current, testsUnlocked: true });
      }
    } catch {
      /* prochain intervalle */
    } finally {
      this.testsPollInFlight = false;
      this.syncTestsPoll();
    }
  }

  private persistUi(): void {
    sessionStorage.setItem(UI_KEY, JSON.stringify(this.ui()));
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LaunchSession;
        if (parsed.expiresAt > Date.now()) {
          this.session.set(parsed);
          const isMock = sessionStorage.getItem(MOCK_FLAG) === '1';
          this.mock.set(isMock);
          if (isMock) {
            this.mockApi = MockLoutravoBackend.fromSession(parsed);
          }
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      const uiRaw = sessionStorage.getItem(UI_KEY);
      if (uiRaw) {
        const parsedUi = JSON.parse(uiRaw) as Partial<UiState>;
        this.ui.set({ ...emptyUi(), ...parsedUi, quizPassed: parsedUi.quizPassed ?? {} });
      }
    } catch {
      this.clear();
    }
  }

  private requireSession(): LaunchSession {
    const s = this.session();
    if (!s || s.expiresAt <= Date.now()) {
      throw new LoutravoError(401, 'UNAUTHENTICATED', 'Session expirée. Relance cette activité depuis Loutravo.');
    }
    return s;
  }

  private requireMock(): MockLoutravoBackend {
    if (!this.mockApi) {
      const s = this.session();
      this.mockApi = s ? MockLoutravoBackend.fromSession(s) : MockLoutravoBackend.fromCodes();
    }
    return this.mockApi;
  }

  private capture(err: unknown): void {
    if (err instanceof LoutravoError) {
      this.errorMessage.set(err.message);
      if (err.needsRelaunch) {
        this.clear();
      }
      return;
    }
    this.errorMessage.set('Impossible de joindre Loutravo.');
  }
}
