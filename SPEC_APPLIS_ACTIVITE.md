# Spécification technique — Applis d’activité Loutravo

**Version :** 1.0 — 26 août 2026  
**Public :** développeurs d’applis web d’activité (projets Firebase **distincts** de Loutravo)  
**Hub :** projet Firebase `loutravo`, région `europe-west1`

Ce document décrit **uniquement** ce que l’appli d’activité doit respecter pour s’intégrer à Loutravo. Loutravo reste le seul système de confiance : identité élève, droit de démarrer, avancement.

---

## 1. Principes

1. **Projets séparés.** L’appli d’activité a son propre projet Firebase (Hosting, éventuellement Firestore pédagogique). Elle n’a **aucun** accès au Firestore ni à l’Auth Loutravo.
2. **Pas d’identité nominative.** L’élève n’a ni nom, ni e-mail dans Loutravo. L’appli ne doit jamais demander un nom, un e-mail ou un mot de passe Loutravo. L’identifiant opaque est `loutravoUid`.
3. **Loutravo autorise, l’appli enseigne.** Le professeur enregistre l’appli et l’attribue à un élève. L’appli guide les chapitres et **signale** l’avancement à Loutravo.
4. **Aucun écriture directe** dans Loutravo. Seulement les deux HTTP publics ci-dessous.
5. **Chapitres séquentiels.** On ne peut démarrer le chapitre *n* que si les chapitres *1 … n−1* sont `completed`. Loutravo refuse tout saut.

---

## 2. Enregistrement dans Loutravo (côté professeur)

Dans **Admin → Applis d’activité guidées** :

| Champ | Règle |
|--------|--------|
| Nom | Affiché à l’élève et au professeur |
| URL de lancement | URL HTTPS de l’appli. Loutravo y ajoute `?launch=CODE` (ou `&launch=` si la query existe déjà) |
| Chapitres | Un titre par ligne, **dans l’ordre pédagogique**. Loutravo génère les `id` (slug) |

L’appli **doit** utiliser les `id` de chapitres renvoyés par `redeemLaunch`, pas des identifiants inventés de son côté.

Ensuite, sur la **fiche élève**, le professeur clique **Autoriser**. Sans cette attribution, `startActivity` et `redeemLaunch` échouent.

---

## 3. Flux de session

```
Élève dans Loutravo  →  Démarrer
        │
        │  startActivity (callable, session Loutravo)
        ▼
URL https://ton-appli.web.app/?launch=<CODE>
        │
        │  POST redeemLaunch { code }
        ▼
sessionToken + liste des chapitres + avancement actuel
        │
        │  à chaque étape : POST reportProgress
        ▼
Loutravo met à jour la fiche élève et le journal
```

- `CODE` : usage **unique**, valable **5 minutes**.
- `sessionToken` : valable **12 heures**. Au-delà, l’élève relance depuis Loutravo.

---

## 4. Ouverture de l’appli

L’élève n’arrive **que** via Loutravo (bouton Démarrer). L’appli lit le paramètre de query :

```
launch   string   code à échanger immédiatement
```

Exemple : `https://install-poste.web.app/?launch=Ab3…`

Dès le chargement :

1. Lire `launch` dans l’URL.
2. Appeler `redeemLaunch` **une seule fois**.
3. Oublier le code (il est consommé).
4. Stocker `sessionToken` (mémoire ou `sessionStorage`, pas un cookie tiers).
5. Afficher le parcours à partir de `currentChapterId` / `completedChapterIds`.

Si `launch` est absent ou `redeemLaunch` échoue : écran d’erreur « Relance cette activité depuis Loutravo ». Ne pas proposer de saisie du jeton `ABC-12345` sauf secours documenté (hors spec v1).

---

## 5. API HTTP

Base :

```
https://europe-west1-loutravo.cloudfunctions.net
```

- Méthode : **POST** uniquement (`405` sinon).
- Corps : **JSON** (`Content-Type: application/json`).
- CORS : activé.
- Pas d’authentification Firebase Loutravo sur ces deux routes : la preuve est le `code` puis le `sessionToken`.

### 5.1 `POST /redeemLaunch`

**Requête**

```json
{ "code": "string" }
```

**Réponse 200**

```json
{
  "loutravoUid": "string",
  "appId": "string",
  "assignmentId": "string",
  "sessionToken": "string",
  "expiresAt": 1720000000000,
  "chapters": [
    { "id": "installer-windows", "title": "Installer Windows", "order": 0 }
  ],
  "currentChapterId": "installer-windows",
  "completedChapterIds": [],
  "status": "assigned"
}
```

| Champ | Description |
|--------|-------------|
| `loutravoUid` | Identifiant opaque de l’élève. Ne pas l’afficher. Sert de clé locale si besoin. |
| `appId` | Identifiant de l’appli dans Loutravo |
| `assignmentId` | Attribution élève + appli |
| `sessionToken` | Jeton HMAC à renvoyer tel quel à `reportProgress` |
| `expiresAt` | Fin de validité du `sessionToken`, epoch **millisecondes** |
| `chapters` | Parcours officiel, trié par `order` |
| `currentChapterId` | Chapitre en cours, ou `null` si pas encore commencé |
| `completedChapterIds` | Chapitres déjà `completed` |
| `status` | `assigned` \| `in_progress` \| `completed` |

### 5.2 `POST /reportProgress`

**Requête**

```json
{
  "sessionToken": "string",
  "chapterId": "installer-windows",
  "status": "started"
}
```

| Champ | Valeurs |
|--------|---------|
| `sessionToken` | Jeton issu de `redeemLaunch` |
| `chapterId` | Un `id` de `chapters` |
| `status` | `started` ou `completed` |

Appeler `started` à l’entrée du chapitre, `completed` quand l’élève le valide et passe au suivant.

**Réponse 200**

```json
{
  "ok": true,
  "appId": "string",
  "chapterId": "installer-windows",
  "status": "completed",
  "assignmentStatus": "in_progress",
  "currentChapterId": "installer-windows",
  "completedChapterIds": ["installer-windows"]
}
```

Quand tous les chapitres sont `completed`, `assignmentStatus` vaut `completed`.

### 5.3 Erreurs

Corps :

```json
{ "error": { "status": "NOT_FOUND", "message": "…" } }
```

| HTTP | `status` | Cas typique |
|------|----------|-------------|
| 400 | `INVALID_ARGUMENT` | JSON incomplet, `chapterId` inconnu, `status` invalide |
| 401 | `UNAUTHENTICATED` | `sessionToken` invalide ou expiré |
| 403 | `PERMISSION_DENIED` | Activité non attribuée ou révoquée |
| 404 | `NOT_FOUND` | Code de lancement inconnu ; appli inactive |
| 409 | `FAILED_PRECONDITION` | Code déjà utilisé ; chapitre sauté ; chapitre déjà terminé (`started`) |
| 410 | `DEADLINE_EXCEEDED` | Code `launch` expiré (> 5 min) |
| 405 | `INVALID_ARGUMENT` | Méthode autre que POST |
| 500 | `INTERNAL` | Erreur serveur |

Message `failed-precondition` si un chapitre précédent n’est pas terminé, du type : `Termine d’abord : Installer Windows.`

---

## 6. Règles de parcours

Soit les chapitres `[A, B, C]` dans l’ordre `order`.

| Action | Autorisée si |
|--------|----------------|
| `started` sur A | A n’est pas dans `completedChapterIds` |
| `completed` sur A | toujours (A n’a pas de prédécesseur) |
| `started` / `completed` sur B | A est dans `completedChapterIds` |
| `started` sur un chapitre déjà `completed` | **refusée** |
| `completed` une seconde fois | acceptée (idempotent) |

L’appli doit :

- n’afficher comme « jouable » que le premier chapitre non terminé (et éventuellement relire les précédents en lecture seule) ;
- envoyer `started` en entrant dans un chapitre, `completed` en le quittant vers le suivant ;
- resynchroniser l’UI avec la réponse de `reportProgress` (source de vérité).

---

## 7. Ce que l’appli ne doit pas faire

- Appeler l’Auth ou le Firestore du projet `loutravo`.
- Stocker le jeton élève `ABC-12345` ou le `sessionToken` de façon permanente (localStorage longue durée, backend non chiffré).
- Inventer des `chapterId` absents de `redeemLaunch`.
- Signaler un progrès pour un autre élève (le `sessionToken` est lié à un `uid` + `appId`).
- Considérer un chapitre terminé **uniquement** en local : sans `reportProgress` `completed`, Loutravo ignore l’avancement.
- Collecter nom, photo, e-mail ou toute donnée nominative.

---

## 8. Exemple minimal (navigateur)

```javascript
const HUB = 'https://europe-west1-loutravo.cloudfunctions.net';

async function boot() {
  const code = new URLSearchParams(location.search).get('launch');
  if (!code) throw new Error('Relance cette activité depuis Loutravo.');

  const session = await post('/redeemLaunch', { code });
  sessionStorage.setItem('loutravo.session', JSON.stringify(session));
  history.replaceState({}, '', location.pathname);
  render(session);
}

async function complete(chapterId) {
  const session = JSON.parse(sessionStorage.getItem('loutravo.session'));
  const next = await post('/reportProgress', {
    sessionToken: session.sessionToken,
    chapterId,
    status: 'completed',
  });
  session.completedChapterIds = next.completedChapterIds;
  session.currentChapterId = next.currentChapterId;
  session.status = next.assignmentStatus;
  sessionStorage.setItem('loutravo.session', JSON.stringify(session));
}

async function post(path, body) {
  const res = await fetch(HUB + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || res.statusText);
  return data;
}
```

---

## 9. Journal de travaux

Une fois l’appli **autorisée**, elle apparaît dans le journal de **cet** élève (créneau horaire). Le chapitre courant est proposé comme libellé. L’élève saisit toujours ses heures dans Loutravo ; l’appli ne transmet **que** l’avancement pédagogique (`chapterId` + `status`).

---

## 10. Checklist avant mise en production d’une appli

- [ ] URL HTTPS enregistrée dans l’admin Loutravo, identique à l’URL réellement ouverte
- [ ] Lecture de `?launch=` au démarrage et appel immédiat à `redeemLaunch`
- [ ] Conservation du `sessionToken` le temps de la session uniquement
- [ ] `reportProgress` `started` puis `completed` pour chaque chapitre, dans l’ordre
- [ ] Gestion des HTTP 401 / 409 / 410 avec message « relancer depuis Loutravo »
- [ ] Aucune donnée nominative
- [ ] Test : élève non autorisé → `redeemLaunch` / `startActivity` refusés
- [ ] Test : révocation professeur → `reportProgress` en 403
