import { applyHubTitle, CHAPTER_BANK, emptyChapterContent, findContent } from '../src/app/core/content/chapters';
import { aliasOverrideMarkdown, mergeOverrideMaps, pickOverrideMarkdown, pickWorkingCopy } from '../src/app/core/content/override-lookup';
import { chapterListTitle, extractChapterCode } from '../src/app/core/content/chapter-id';
import { applyMarkdownOverride, applySectionEdit, chapterToMarkdown, LAYOUT_SENTINEL } from '../src/app/core/content/chapter-markdown';
import { SECTION_PICKER, SECTION_TITLE } from '../src/app/core/content/chapter.types';
import { buildDisplaySections, sectionToEditText } from '../src/app/core/content/display-sections';
import { chapterFromDisplay, extractFileLinks, insertSectionAt, moveSectionAt, removeSectionAt } from '../src/app/core/content/section-crud';
import { chapterMilestone, groupByMilestones } from '../src/app/core/content/bank/groups';
import { MILESTONES } from '../src/app/core/content/bank/milestones';
import { PEDAGOGY } from '../src/app/core/content/bank/pedagogy';
import { MockLoutravoBackend } from '../src/app/core/loutravo/loutravo.mock';
import { chapterAccess, isPreviewFlag } from '../src/app/core/session/chapter-access';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new Error(message);
  }
}

const codes = CHAPTER_BANK.map((c) => c.code);
assert(CHAPTER_BANK.length === 10, `Attendu 10 fiches locales, reçu ${CHAPTER_BANK.length}`);
assert(new Set(codes).size === 10, 'Codes de chapitre en double');
assert(codes.join(',') === 'A1,A2,A3,A4,A5,A6,A7,A8,A9,A10', `Ordre A1–A10, reçu ${codes.join(',')}`);

for (const ch of CHAPTER_BANK) {
  assert(ch.learningObjective.trim().length > 12, `${ch.code}: learningObjective trop court`);
  assert(ch.hints.length >= 2, `${ch.code}: au moins 2 indices`);
  assert(ch.quiz.length >= 2 && ch.quiz.length <= 4, `${ch.code}: quiz 2–4 questions (reçu ${ch.quiz.length})`);
  for (const q of ch.quiz) {
    assert(q.choices.length >= 2, `${ch.code}/${q.id}: pas assez de choix`);
    assert(q.correctIndex >= 0 && q.correctIndex < q.choices.length, `${ch.code}/${q.id}: correctIndex invalide`);
    assert(q.explain.trim().length > 8, `${ch.code}/${q.id}: explain manquant`);
  }
  assert(PEDAGOGY[ch.code], `${ch.code}: entrée PEDAGOGY manquante`);
}

for (const m of MILESTONES) {
  const hit = CHAPTER_BANK.find((c) => c.code === m.code);
  assert(hit, `Jalon ${m.code} absent du bank`);
}

assert(extractChapterCode('A5 — Ajouter une carte d’extension') === 'A5', 'extract titre A5');
assert(extractChapterCode('a10-partages-et-ntfs-en-workgroup') === 'A10', 'extract slug A10');
assert(
  chapterListTitle({
    id: 'a10-partages-et-ntfs-en-workgroup',
    code: 'A10',
    hubTitle: 'Schéma logique de réseau',
    contentTitle: 'A10 — Partages et NTFS en workgroup',
  }) === 'Schéma logique de réseau',
  'parcours : titre hub, pas l’id slug',
);
assert(
  chapterListTitle({
    id: 'a10-partages-et-ntfs-en-workgroup',
    code: 'A10',
    hubTitle: 'a10-partages-et-ntfs-en-workgroup',
    contentTitle: 'A10 — Partages et NTFS en workgroup',
  }) === 'Partages et NTFS en workgroup',
  'parcours : titre de fiche si le hub n’a que l’id',
);
assert(extractChapterCode('b7-premier-dc-virtuel-et-jointure') === 'B7', 'extract slug B7');

const bySlug = findContent('adresses-wan-et-lan', 'A5 — Adresses WAN et LAN');
assert(bySlug?.code === 'A5', 'findContent doit aligner le slug hub sur A5');
assert(bySlug?.id === 'adresses-wan-et-lan', 'findContent A5 : id bundlé');
assert(
  !findContent('a15-nouveau-chapitre', 'Nouveau chapitre'),
  'chapitre inconnu : le slug ne vole pas une fiche de la banque',
);
{
  const blank = emptyChapterContent({ id: 'a15-nouveau-chapitre', title: 'Nouveau chapitre', code: 'A15' });
  assert(blank.code === 'A15', 'fiche vide : code hub');
  assert(blank.layout?.length === 0, 'fiche vide : layout éditable');
}

const a0 = CHAPTER_BANK.find((c) => c.code === 'A1');
assert(a0, 'A1 présent');
assert(a0.id === 'commutateur-interne-et-nat', 'A1 : id');
assert(a0.title === 'A1 — Commutateur interne et NAT', 'A1 : titre');
{
  const hubTitle = 'Réseau NAT de l’atelier';
  const renamed = applyHubTitle(a0, hubTitle);
  assert(renamed, 'applyHubTitle garde la fiche');
  assert(renamed !== a0, 'applyHubTitle ne mute pas CHAPTER_BANK');
  assert(renamed.title === hubTitle, 'titre hub prime sur le bundlé');
  assert(a0.title === 'A1 — Commutateur interne et NAT', 'fiche bundlée inchangée');
  assert(buildDisplaySections(renamed)[0]?.title === hubTitle, 'carte Titre : libellé Loutravo');
  const withLayout = applyMarkdownOverride(a0, chapterToMarkdown(a0));
  const renamedLayout = applyHubTitle(withLayout, hubTitle);
  assert(renamedLayout?.layout?.find((c) => c.kind === 'title')?.title === hubTitle, 'layout : titre hub');
  assert(buildDisplaySections(renamedLayout!)[0]?.title === hubTitle, 'carte Titre après override : libellé Loutravo');
  assert(findContent(a0.id, hubTitle)?.code === 'A1', 'findContent A1 malgré un titre hub renommé');
}

{
  const custom = '# Réseau NAT de l’atelier\n\nTexte professeur\n';
  const byBundledId = { [a0.id]: custom };
  assert(
    pickOverrideMarkdown(byBundledId, 'reseau-nat-de-l-atelier', a0) === custom,
    'calque retrouvé via l’id bundlé si Loutravo a changé le slug',
  );
  assert(pickOverrideMarkdown({ [a0.code]: custom }, a0.id, a0) === custom, 'calque retrouvé via le code A1');
  const merged = mergeOverrideMaps({ [a0.id]: custom }, { [a0.id]: '' });
  assert(merged[a0.id] === custom, 'un markdown vide distant n’efface pas le calque local');
  const aliased = aliasOverrideMarkdown('reseau-nat-de-l-atelier', a0, custom);
  assert(aliased[a0.code] === custom && aliased[a0.id] === custom, 'sauvegarde : alias id bundlé + code');
  const first = applyMarkdownOverride(a0, '# A\n\nPremier\n');
  const second = applyMarkdownOverride(a0, '# A\n\nDeuxieme\n');
  const copies = { [a0.id]: first };
  copies[a0.id] = second;
  assert(pickWorkingCopy(copies, a0.id, a0)?.summary !== first.summary, 'chaque modification écrase la précédente');
  assert(String(pickWorkingCopy(copies, a0.id, a0)?.summary).includes('Deuxieme') || pickWorkingCopy(copies, a0.id, a0)?.layout, 'copie de travail = dernière version');
}
assert(
  a0.sections.some((s) => /introduction/i.test(s.title) && (s.paragraphs?.join(' ') ?? '').includes('Labo OPNsense')),
  'A1 : introduction à Labo OPNsense',
);
{
  const intro = a0.sections.find((s) => /introduction/i.test(s.title));
  const blob = intro?.paragraphs?.join(' ') ?? '';
  assert(!/t[’']aide|accompagne|compagnon/i.test(blob), 'A1 : Labo OPNsense est l’activité, pas un accompagnement');
}

const commandBlob = CHAPTER_BANK.flatMap((c) => c.commands).join('\n');
assert(commandBlob.includes('New-VMSwitch'), 'commande New-VMSwitch');
assert(commandBlob.includes('New-NetIPAddress'), 'commande New-NetIPAddress');
assert(commandBlob.includes('New-NetNat'), 'commande New-NetNat');
assert(
  CHAPTER_BANK.some((c) => c.commands.some((cmd) => cmd.includes('Set-VMNetworkAdapterVlan') && cmd.includes('-Access'))),
  'Set-VMNetworkAdapterVlan -Access',
);
assert(
  CHAPTER_BANK.some((c) => c.commands.some((cmd) => cmd.includes('Set-VMNetworkAdapterVlan') && cmd.includes('-Trunk'))),
  'Set-VMNetworkAdapterVlan -Trunk',
);
assert(commandBlob.includes('AllowedVlanIdList'), 'AllowedVlanIdList');
assert(!/Default Switch/.test(commandBlob), 'les commandes n’utilisent pas le Default Switch');

const bankText = JSON.stringify(CHAPTER_BANK);
assert(!/Rufus/.test(bankText), 'pas de clé USB Rufus');
const a5 = CHAPTER_BANK.find((c) => c.code === 'A5');
assert(a5 && JSON.stringify(a5).includes('192.168.5.2'), 'A5 : WAN fixe 192.168.5.2');
assert(a5 && /serveur DHCP/i.test(JSON.stringify(a5)), 'A5 : le WAN fixe est expliqué');
const a8 = CHAPTER_BANK.find((c) => c.code === 'A8');
assert(a8 && /Tu ne changes pas encore le VLAN/.test(JSON.stringify(a8)), 'A8 : VLAN Hyper-V plus tard');
const a9 = CHAPTER_BANK.find((c) => c.code === 'A9');
assert(a9 && /commutateur physique/i.test(JSON.stringify(a9)), 'A9 : pas de commutateur physique');

const subset = ['A1', 'A5', 'A10'].map((code) => {
  const c = CHAPTER_BANK.find((x) => x.code === code);
  assert(c, code);
  return { id: c.id, title: c.title, order: 0, content: c };
});
const groups = groupByMilestones(subset);
assert(groups.length === 2, `sous-ensemble : 2 groupes (A1+A5, A10), reçu ${groups.length}`);
assert(groups[0]?.milestone?.code === 'A5', 'premier groupe fermé par A5');
assert(groups[0]?.items.map((i) => i.content?.code).join(',') === 'A1,A5', 'A1 est dans le groupe A5');
assert(groups[1]?.milestone?.code === 'A10', 'A10 jalon seul');
assert(
  chapterMilestone({ id: 'custom', title: 'Adresses du lab', code: 'A5' })?.code === 'A5',
  'jalon via le numéro jaune Loutravo, même si le titre n’a plus le préfixe A5',
);
assert(
  chapterMilestone({ id: 'custom', title: 'Étape libre', hubMilestone: true })?.shortTitle === 'Jalon',
  'jalon marqué dans Admin → Parcours',
);

const mock = MockLoutravoBackend.fromCodes(['A1', 'A5', 'A10']);
const session = mock.redeem();
assert(session.chapters.length === 3, `mock sous-ensemble 3 chapitres, reçu ${session.chapters.length}`);
const first = session.chapters[0];
const second = session.chapters[1];
assert(first && second, 'mock chapters');
mock.report('mock-session', first.id, 'started');
mock.report('mock-session', first.id, 'completed');
const afterA5 = mock.report('mock-session', second.id, 'started');
assert(afterA5.ok, 'A5 jouable après A1 si le hub n’a envoyé que A1, A5, A10');
const last = session.chapters[2];
assert(last, 'third');
mock.report('mock-session', second.id, 'completed');
mock.report('mock-session', last.id, 'started');
const done = mock.report('mock-session', last.id, 'completed');
assert(done.assignmentStatus === 'completed', 'séance partielle terminée = completed (pas 10/10)');
assert(done.completedChapterIds.length === 3, '3 completed, pas 10');

const sequential = chapterAccess(
  [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ],
  ['a'],
  false,
);
assert(sequential[0]?.completed && !sequential[0].locked, 'élève : A terminé, relire');
assert(sequential[1]?.playable && !sequential[1].locked, 'élève : B jouable');
assert(sequential[2]?.locked && !sequential[2].playable, 'élève : C verrouillé');
const closedTest = chapterAccess(
  [
    { id: 'a', order: 0 },
    { id: 't', order: 1, title: 'Test — exemple', test: true },
  ],
  ['a'],
  false,
  false,
);
assert(closedTest[1]?.testLocked && !closedTest.some((item) => item.playable), 'test fermé sans déblocage');
assert(chapterAccess([{ id: 't', order: 0, test: true }], [], true)[0]?.playable, 'aperçu : test ouvert');

const previewAccess = chapterAccess(
  [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ],
  [],
  true,
);
assert(
  previewAccess.every((c) => c.playable && !c.locked),
  'aperçu : tous les chapitres ouverts, aucun verrou',
);
assert(isPreviewFlag(true) && isPreviewFlag('true') && !isPreviewFlag(false), 'isPreviewFlag');

const previewSession = MockLoutravoBackend.fromCodes(['A1', 'A5']).redeem(true);
assert(previewSession.preview === true, 'mock redeem preview: true');
assert(previewSession.completedChapterIds.length === 0, 'aperçu : pas d’avancement élève');

for (const ch of CHAPTER_BANK) {
  const display = buildDisplaySections(ch);
  const kinds = display.map((s) => s.kind);
  assert(kinds[0] === 'title', `${ch.code}: carte Titre en premier`);
  assert(kinds.includes('objectives'), `${ch.code}: Objectifs`);
  assert(kinds.includes('deliverables'), `${ch.code}: Livrables`);
  const deliverablesAt = kinds.indexOf('deliverables');
  assert(kinds[deliverablesAt + 1] === 'resources', `${ch.code}: Ressources sous Livrables`);
  assert(kinds.includes('do'), `${ch.code}: À toi de faire`);
  assert(kinds.includes('see'), `${ch.code}: Ce que tu dois voir`);
  assert(kinds.at(-1) === 'quiz', `${ch.code}: Quiz en dernier`);
  const doCard = display.find((s) => s.kind === 'do');
  assert(doCard?.title === SECTION_TITLE.do, `${ch.code}: titre exact « À toi de faire »`);
  const seeCard = display.find((s) => s.kind === 'see');
  assert(seeCard?.title === SECTION_TITLE.see, `${ch.code}: titre exact « Ce que tu dois voir »`);
}

const a0Display = buildDisplaySections(a0);
const md = chapterToMarkdown(a0);
assert(md.includes(LAYOUT_SENTINEL), 'markdown : sentinelle de cartes');
assert(md.includes(`## ${SECTION_TITLE.resources}`), 'markdown : Ressources');
assert(md.includes(`## ${SECTION_TITLE.do}`), 'markdown : À toi de faire');
assert(md.includes(`## ${SECTION_TITLE.see}`), 'markdown : Ce que tu dois voir');
assert(md.includes(`## ${SECTION_TITLE.quiz}`), 'markdown : Quiz sérialisé');
const restored = applyMarkdownOverride(a0, md);
assert(restored.layout?.length === a0Display.length, 'round-trip : même nombre de cartes');
assert(restored.objectives.join('|') === a0.objectives.join('|'), 'round-trip objectifs A0');
assert(restored.checklist.map((x) => x.label).join('|') === a0.checklist.map((x) => x.label).join('|'), 'round-trip checklist A0');
assert(restored.quiz.length === a0.quiz.length, 'quiz bundlé conservé après override');
const restoredTitle = restored.layout?.find((c) => c.kind === 'title');
assert(restoredTitle?.summary === a0.summary, 'round-trip résumé A0');
assert(!String(restoredTitle?.summary).includes('**'), 'round-trip titre : pas de ** dans le résumé');
assert(restoredTitle?.learningObjective === a0.learningObjective, 'round-trip objectif A0');

const titleSec = a0Display.find((s) => s.key === 'title');
assert(titleSec, 'section titre');
const edited = applySectionEdit(a0, titleSec, 'Nouveau résumé\n\nÀ la fin, tu sauras… nommer une machine.');
assert(edited.summary === 'Nouveau résumé', 'édition titre : résumé');
assert(edited.learningObjective === 'nommer une machine.', 'édition titre : objectif');
const editedRound = applyMarkdownOverride(a0, chapterToMarkdown(edited));
const editedTitle = editedRound.layout?.find((c) => c.kind === 'title');
assert(editedTitle?.summary === 'Nouveau résumé', 'round-trip édition titre : résumé sans **');
assert(!String(editedTitle?.summary).includes('*'), 'round-trip édition titre : aucun * orphelin');

{
  const polluted = md.replace(
    `${a0.summary}\n\n**À la fin, tu sauras…**`,
    `${a0.summary}\n\n**\n\n**À la fin, tu sauras…**`,
  );
  const cleaned = applyMarkdownOverride(a0, polluted);
  const cleanedTitle = cleaned.layout?.find((c) => c.kind === 'title');
  assert(cleanedTitle?.summary === a0.summary, 'nettoyage des ** orphelins déjà enregistrés');
}

{
  const introSec = a0Display.find((s) => s.kind === 'intro');
  assert(introSec, 'section intro A0');
  const withBreaks = applySectionEdit(
    a0,
    introSec,
    `${introSec.title}\n\nPremière ligne\nDeuxième ligne\n- puce A\n- puce B`,
  );
  const intro = withBreaks.sections[0];
  assert(intro.paragraphs.some((p) => p.includes('Première ligne') && p.includes('Deuxième ligne')), 'intro : retour à la ligne conservé');
  assert(intro.bullets.includes('puce A') && intro.bullets.includes('puce B'), 'intro : puces avec « - »');
}

{
  const extracted = extractFileLinks('Notice\n\n[Télécharger : plan.pdf](https://cdn.example/plan.pdf)');
  assert(extracted.files[0]?.label === 'plan.pdf', 'extractFileLinks label');
  assert(extracted.files[0]?.url === 'https://cdn.example/plan.pdf', 'extractFileLinks url');
  assert(extracted.text.includes('Notice'), 'extractFileLinks garde le texte');
}

{
  const resourcesSec = a0Display.find((s) => s.kind === 'resources');
  assert(resourcesSec, 'carte Ressources bundlée');
  const withResources = applySectionEdit(
    a0,
    resourcesSec,
    'Fiche d’adressage\n\n[Télécharger : plan.pdf](https://cdn.example/plan.pdf)',
  );
  assert(withResources.resources.includes('Fiche d’adressage'), 'édition Ressources : texte');
  assert(withResources.resourceFiles[0]?.label === 'plan.pdf', 'édition Ressources : fichier');
}

{
  const inserted = insertSectionAt(a0Display, 4, 'intro', a0.title);
  assert(inserted.length === a0Display.length + 1, 'insertSectionAt ajoute une carte');
  assert(inserted[4]?.kind === 'intro', 'insertSectionAt au bon index');
  const moved = moveSectionAt(inserted, 4, -1);
  assert(moved[3]?.kind === 'intro', 'moveSectionAt avant la précédente');
  assert(moved[4]?.kind === inserted[3]?.kind, 'moveSectionAt échange avec le voisin');
  assert(SECTION_PICKER.some((o) => o.kind === 'know' && o.label === SECTION_TITLE.know), 'sélecteur : À savoir');
  const withKnow = insertSectionAt(a0Display, 5, 'know', a0.title);
  assert(withKnow[5]?.kind === 'know', 'insert À savoir');
  assert(withKnow[5]?.title === SECTION_TITLE.know, 'titre figé À savoir');
  const knowMd = chapterToMarkdown(chapterFromDisplay(a0, withKnow));
  assert(knowMd.includes(`## ${SECTION_TITLE.know}`), 'markdown : À savoir');
  const knowRestored = applyMarkdownOverride(a0, knowMd);
  assert(knowRestored.layout?.some((c) => c.kind === 'know'), 'round-trip À savoir');
  const removed = removeSectionAt(inserted, 4);
  assert(removed.length === a0Display.length, 'removeSectionAt retire la carte');
  const emptied = removeSectionAt(a0Display, 0);
  const emptyChapter = chapterFromDisplay(
    a0,
    a0Display.slice(0, 0),
  );
  assert(emptyChapter.layout?.length === 0, 'layout vide si plus aucune section');
  const emptyMd = chapterToMarkdown(emptyChapter);
  const emptyRestored = applyMarkdownOverride(a0, emptyMd);
  assert(emptyRestored.layout?.length === 0, 'round-trip : chapitre sans section');
  assert(emptied.length === a0Display.length - 1, 'removeSectionAt première carte');

  const withNew = chapterFromDisplay(a0, insertSectionAt(a0Display, 3, 'resources', a0.title));
  assert(withNew.layout?.some((c) => c.kind === 'resources'), 'ajout Ressources dans le layout');
  const newIntro = chapterFromDisplay(a0, insertSectionAt(a0Display, 4, 'intro', a0.title));
  const introMd = chapterToMarkdown(newIntro);
  const introRestored = applyMarkdownOverride(a0, introMd);
  const addedIntro = introRestored.layout?.find((c) => c.kind === 'intro' && c.title === 'Introduction');
  assert(addedIntro, 'intro ajoutée round-trip');
  assert(
    !(addedIntro.paragraphs ?? []).includes('Introduction'),
    'intro ajoutée : le titre n’est pas recopié dans le corps',
  );
  const doRound = applyMarkdownOverride(a0, chapterToMarkdown(a0));
  const doCard = doRound.layout?.find((c) => c.kind === 'do');
  assert(doCard?.checklist?.length === a0.checklist.length, 'do : checklist sans doublon de puces');
  assert(!(doCard?.bullets?.length), 'do : puces checklist non dupliquées');

  const doSec = a0Display.find((s) => s.kind === 'do');
  assert(doSec, 'section do A0');
  const mixed = applySectionEdit(
    a0,
    doSec,
    'Prépare le poste.\n- Première tâche\nLis le résultat à l’écran.\n- Deuxième tâche\n`ipconfig`',
  );
  const mixedDo = mixed.layout?.find((c) => c.kind === 'do');
  assert(mixedDo?.flow?.length === 5, 'do : flux mixte de 5 blocs');
  assert(mixedDo?.flow?.[0].type === 'text' && mixedDo.flow[0].text.includes('Prépare'), 'do : texte avant la première case');
  assert(mixedDo?.flow?.[1].type === 'task' && mixedDo.flow[1].label === 'Première tâche', 'do : première case');
  assert(mixedDo?.flow?.[2].type === 'text' && mixedDo.flow[2].text.includes('Lis le résultat'), 'do : texte entre les cases');
  assert(mixedDo?.flow?.[3].type === 'task' && mixedDo.flow[3].label === 'Deuxième tâche', 'do : deuxième case');
  assert(mixedDo?.flow?.[4].type === 'command' && mixedDo.flow[4].text === 'ipconfig', 'do : commande après les cases');
  assert(
    mixedDo?.checklist?.map((x) => x.label).join('|') === 'Première tâche|Deuxième tâche',
    'do : checklist dérivée des cases seulement',
  );
  const mixedDisplay = buildDisplaySections(mixed).find((s) => s.kind === 'do');
  assert(mixedDisplay, 'affichage do mixte');
  const mixedText = sectionToEditText(mixedDisplay);
  assert(mixedText.indexOf('Prépare') < mixedText.indexOf('- Première tâche'), 'édition : texte avant la case');
  assert(mixedText.indexOf('- Première tâche') < mixedText.indexOf('Lis le résultat'), 'édition : texte intercalé');
  assert(mixedText.indexOf('Lis le résultat') < mixedText.indexOf('- Deuxième tâche'), 'édition : texte avant la seconde case');
  const mixedRound = applyMarkdownOverride(a0, chapterToMarkdown(mixed));
  const mixedRoundDo = mixedRound.layout?.find((c) => c.kind === 'do');
  assert(mixedRoundDo?.flow?.[2].type === 'text', 'round-trip : texte intercalé conservé');
  assert(mixedRoundDo?.flow?.[1].type === 'task' && mixedRoundDo.flow[3].type === 'task', 'round-trip : cases conservées');
  const deletedQuiz = chapterFromDisplay(
    a0,
    a0Display.filter((s) => s.kind !== 'quiz'),
  );
  assert(!deletedQuiz.layout?.some((c) => c.kind === 'quiz'), 'suppression Quiz');
  assert(deletedQuiz.quiz.length === 0, 'plus de questions après suppression Quiz');
}

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../src');
const uiBlob = [
  readFileSync(join(srcRoot, 'app/pages/parcours/parcours-page.html'), 'utf8'),
  readFileSync(join(srcRoot, 'app/core/content/bank/part-a.ts'), 'utf8'),
  readFileSync(join(srcRoot, 'app/core/content/bank/part-b.ts'), 'utf8'),
  readFileSync(join(srcRoot, 'app/pages/chapter/chapter-page.html'), 'utf8'),
  readFileSync(join(srcRoot, 'app/pages/chapter/chapter-page.ts'), 'utf8'),
  readFileSync(join(srcRoot, 'app/core/loutravo/loutravo.api.ts'), 'utf8'),
  readFileSync(join(srcRoot, 'app/ui/section-card.ts'), 'utf8'),
  readFileSync(join(srcRoot, 'app/ui/md-text.ts'), 'utf8'),
].join('\n');
assert(!/accompagne/i.test(uiBlob), 'pas de « accompagne » dans l’UI / fiches');
assert(!/compagnon/i.test(uiBlob), 'pas de « compagnon » dans l’UI / fiches');
assert(!/t[’']aide pour l[’']activité/i.test(uiBlob), 'pas de « t’aide pour l’activité »');
assert(/function markdownLinkTag/.test(uiBlob), 'helper markdownLinkTag');
assert(/function insertMarkdownLink/.test(uiBlob), 'helper insertMarkdownLink');
assert(/insertWebLink/.test(uiBlob), 'aperçu : insertWebLink');
assert(/target="_blank"/.test(uiBlob), 'lien élève : nouvelle fenêtre');
assert(/Insérer le lien/.test(uiBlob), 'aperçu : Insérer le lien');
assert(/Texte affiché/.test(uiBlob), 'aperçu : texte affiché du lien');
assert(/Joindre un fichier/.test(uiBlob), 'aperçu : Joindre un fichier');
assert(/pill milestone/.test(uiBlob), 'liste parcours : pastille jalon');
assert(/Sauvegarder/.test(uiBlob), 'aperçu : bouton Sauvegarder');
assert(/ouvre l’aperçu depuis Loutravo/.test(uiBlob), 'aperçu mock : prévenir que le calque n’est pas sur le hub');
assert(/Ajouter une section au-dessus/.test(uiBlob), 'aperçu : flèche au-dessus');
assert(/Ajouter une section en dessous/.test(uiBlob), 'aperçu : flèche en dessous');
assert(/Avant la section précédente/.test(uiBlob), 'aperçu : déplacer avant');
assert(/Après la section suivante/.test(uiBlob), 'aperçu : déplacer après');
assert(/Envoyer vers un autre chapitre/.test(uiBlob), 'aperçu : envoyer vers un chapitre');
assert(/Supprimer cette section/.test(uiBlob), 'aperçu : corbeille');
assert(/add-first/.test(uiBlob), 'aperçu : + si aucune section');
assert(!/app-lab-terminal/.test(uiBlob), 'pas d’invite de commande simulée sur les pages');
const bugReport = readFileSync(join(srcRoot, 'app/ui/bug-report.ts'), 'utf8');
assert(/app-bug-report/.test(readFileSync(join(srcRoot, 'app/app.html'), 'utf8')), 'bouton signaler un bug');
assert(/Signaler un bug/.test(bugReport) && /Annuler/.test(bugReport) && /Envoyer/.test(bugReport), 'fenêtre signaler un bug');
assert(/reportActivityBug/.test(uiBlob), 'api reportActivityBug');
assert(/Chapitre suivant/.test(uiBlob), 'bouton chapitre suivant');
assert(/checklistDone[\s\S]*groupedDoFlow[\s\S]*quizQuestions/.test(uiBlob), 'validation sur les cases affichées');
assert(/Coche toutes les cases/.test(uiBlob), 'message si une case affichée n’est pas cochée');
assert(/Ce test est fermé/.test(uiBlob), 'chapitre test fermé tant que le professeur ne débloque pas');
assert(!/>Retour</.test(readFileSync(join(srcRoot, 'app/pages/chapter/chapter-page.html'), 'utf8')), 'retour au parcours, pas Retour');

const guard = readFileSync(join(srcRoot, 'app/core/session/session.guard.ts'), 'utf8');
const sessionSrc = readFileSync(join(srcRoot, 'app/core/session/session.service.ts'), 'utf8');
assert(/getSession/.test(sessionSrc) && /refreshTestsUnlocked/.test(sessionSrc), 'séance ouverte relit le déblocage des tests');
assert(guard.includes('ensureContent'), 'un chapitre rechargé relit le texte enregistré');
assert(sessionSrc.includes('async ensureContent'), 'ensureContent recharge le texte');
assert(
  sessionSrc.includes('previewQuery && !(this.isReady() && !this.isMock())'),
  'preview=1 garde une séance Loutravo déjà ouverte',
);

const parcoursPage = readFileSync(join(srcRoot, 'app/pages/parcours/parcours-page.html'), 'utf8');
assert(parcoursPage.includes('Exporter le sujet'), 'export PDF du sujet');
assert(parcoursPage.includes('Exporter mes résultats'), 'export PDF des résultats');
assert(parcoursPage.includes('Inclure le corrigé'), 'corrigé réservé à l’aperçu');

console.log('check-pedagogy: OK (10 fiches, jalons, aperçu, charte, CRUD sections, sous-ensemble mock).');
