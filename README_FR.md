[English](README.md) · **Français**

# Macronome

**Suivi nutritionnel et de poids multi-utilisateur** auto-hébergé, API-first, qui remplace un
classeur Excel utilisé au quotidien. Enregistre ce que tu manges, compare tes calories et tes
macros à tes propres objectifs, suis la tendance de ton poids vers un objectif, et analyse ton
assiduité dans le temps — le tout sur ton propre serveur. Un **administrateur propriétaire** gère
l'instance et peut inviter des comptes supplémentaires, chacun avec des données **isolées** ; il
n'y a **aucune inscription publique**.

![Macronome — journal des repas](docs/img/preview.png)

---

## Qu'est-ce que Macronome ?

Macronome transforme le tableur que beaucoup tiennent pour suivre un régime en une application
web rapide et dense :

- **Enregistre les repas** par aliment et quantité. Chaque jour additionne les calories et les
  trois macros (lipides, glucides, protéines) et les compare à **ta** plage cible — donnant un
  verdict clair **OK / NOK** pour la journée.
- **Suis ton poids** avec de vraies pesées, une tendance lissée, une trajectoire vers l'objectif,
  l'IMC et une date d'atteinte projetée.
- **Comprends ton assiduité** avec des moyennes glissantes, une heatmap du taux d'OK, des
  graphiques mensuels et des signaux en langage clair.
- **Assistance IA optionnelle** — connecte ton propre modèle compatible OpenAI (par ex. Gemini)
  pour estimer les macros d'un plat à partir d'une photo, proposer des repas qui collent à tes
  cibles restantes, et générer des conseils écrits à partir de tes propres données.

Deux principes traversent l'application :

- **Le serveur calcule ; le navigateur ne fait qu'afficher.** Verdicts, dépenses, totaux, EMA,
  IMC, prorata — tout est calculé sur l'API et lu par le SPA.
- **L'historique est figé.** Chaque jour enregistré conserve un instantané de ses cibles et des
  macros des aliments. Modifier un aliment, une recette ou une cible plus tard n'affecte que les
  jours **futurs** — ton passé n'est jamais réécrit en silence.

Autres essentiels : **unités SI** (grammes en interne), interface **français / anglais**, thème
**clair / sombre**, et auto-hébergement **multi-utilisateur** — un administrateur propriétaire
plus des comptes invités, isolés par utilisateur, sans inscription publique.

---

## Fonctionnalités

### Repas — journal alimentaire du jour

L'écran d'accueil. Organise la journée en repas (petit-déjeuner, déjeuner, goûter, dîner…) et
enregistre chaque aliment par son nom avec une quantité et une unité (g/ml/kg ou une **portion
nommée** comme « 1 œuf = 57 g »). Points clés :

- **Autocomplétion** de la recherche d'aliments/recettes ; **calcul** dans les champs de quantité
  (`950/2` → 475).
- Les **épingles du garde-manger (📌)** pré-remplissent les aliments récurrents dans un repas
  chaque jour.
- Raccourcis **Copier hier** et **Tout effacer** ; un **commentaire de journée** libre.
- Le **niveau d'activité** du jour pilote une dépense estimée ; le **verdict OK/NOK** est calculé
  à partir de ta cible calorique et peut être forcé manuellement.
- Types de journée **Complet / Partiel** : journalisation détaillée complète, ou journée résumée
  en calories seules.
- **Prorata des restes** (« mode assiette ») : quand plusieurs aliments partagent une assiette,
  saisis le poids brut + la tare du récipient et Macronome répartit le reste proportionnellement.
- **Mode cuisine** 🍳 : une fenêtre tactile, sans clavier, pour ajuster les poids réels cuisinés.
- **Aliments personnalisés** pour des saisies manuelles ponctuelles, et des **cartes de macros**
  montrant chaque macro face à sa plage cible.
- **Annuler / rétablir** (Ctrl+Z / Ctrl+Y) sur les éditions de lignes — ajout/suppression,
  quantité, unité, épingle, réordonnancement.
- **Somme des lignes sélectionnées** (bureau) : coche un sous-ensemble de lignes d'aliments et lis
  un total courant en grammes / kcal / macros, façon barre d'état d'un tableur.
- **Assistance IA (optionnelle)** : estime les macros d'un plat depuis une photo, ou obtiens des
  **propositions de repas** qui complètent la plage cible restante du jour (voir _Assistant IA_).

### Journal — historique des journées

Une vue d'ensemble triable de chaque jour enregistré, avec des bandes d'état rouge / jaune / vert
(sans donnée / résumé / détaillé). Ouvre n'importe quel jour, corrige les verdicts ou l'activité,
édite en ligne les totaux caloriques, et choisis une année (limitée aux années avec des données).
Exporte l'historique en **CSV** (une ligne récap par jour enregistré, toutes années confondues).

### Poids — poids & tendance

Enregistre des pesées (poids, tour de taille optionnel, indicateur « en régime / maintien », une
note). Le graphique superpose les points réels, une **tendance lissée par EMA**, une **trajectoire
cible** et la ligne d'objectif. Les cartes affichent le poids actuel et son Δ, l'**IMC** avec sa
catégorie, l'écart à l'objectif et une **date d'atteinte projetée**. Un tableau par période
détaille l'apport moyen, la dépense estimée et empirique, et le déficit quotidien entre deux
pesées ; chaque période ouvre aussi un **récap des jours** — chaque jour de l'intervalle de pesée
avec ses calories, ses macros colorées, son verdict et son commentaire, et un clic pour sauter
directement à ce jour. Exporte toutes les pesées en **CSV**.

### Aliments — base d'aliments

Parcours, recherche, crée, note et archive des aliments. Chaque aliment a des macros pour 100 g,
des **portions nommées** optionnelles, une **note** 0–3 et un indicateur de visibilité
privé/partagé. L'outil **« Parser macro »** permet de **coller un tableau nutritionnel copié
depuis un site de courses** et remplit automatiquement les valeurs pour 100 g (kcal / lipides /
glucides / protéines).

### Recettes — recettes

Compose des recettes à partir d'aliments **et** d'autres recettes (imbriquées, sans cycle). Définis
le poids du lot — en mode **Auto** il suit la somme vivante des ingrédients, ou bascule en
**manuel** pour saisir le poids cuit mesuré — et le nombre de portions ; Macronome dérive les
macros pour 100 g et par portion et expose la recette comme un aliment enregistrable doté d'une
unité « portion ».

### Cibles — objectifs & moteur métabolique

Définis tes **min/max caloriques** quotidiens et tes **planchers de macros en g/kg** (protéines,
lipides) ; le **plafond de glucides est dérivé** de ce qu'il reste. Un moteur métabolique en
lecture seule montre ton **MB** (Mifflin-St Jeor), la **dépense estimée** selon l'activité, la
**dépense empirique** issue de la perte de poids réelle, et le **déficit** à ta cible — plus des
**suggestions de g/kg** cliquables et un **IMC cible** dérivé. Les cibles sont **versionnées** avec
des dates d'effet et un recalcul optionnel des verdicts auto passés.

### Stats — assiduité & tendances

Moyennes caloriques glissantes sur **7 / 14 / 30 / 365 jours** (chacune jugée face à la cible de
sa propre fenêtre), un **taux d'OK** annuel avec une **heatmap** d'assiduité, des barres mensuelles
OK/NOK et des graphiques de calories moyennes, et des **signaux** basés sur des règles. Les jours
non enregistrés et futurs sont exclus des taux — jamais comptés comme des échecs.

### Garde-manger — garde-manger

Une liste vivante et globale d'aliments récurrents épinglés par repas. Épingler ajoute l'aliment (à
la quantité 0) à aujourd'hui et aux jours futurs et pré-remplit les nouveaux jours ; la même liste
est modifiable depuis les Paramètres comme depuis l'épingle de l'écran Repas.

### Contenants — contenants réutilisables

Un catalogue par utilisateur de récipients nommés avec un **poids à vide (« tare »)** — une
assiette à 650 g, un bol à 408 g. Ils alimentent le **prorata des restes** du journal : quand
plusieurs aliments partagent une assiette, tu saisis le poids brut et choisis un contenant, et
Macronome soustrait sa tare avant de répartir le reste. Un **« Rien » (0 g)** intégré est toujours
disponible ; le reste est à toi. Modifier ou supprimer un contenant ne réécrit jamais les jours
passés — chaque reste enregistré fige la tare utilisée.

### Assistant IA — assistant IA optionnel

Connecte ton propre point d'accès **compatible OpenAI** (par ex. Google Gemini) depuis une page
dédiée : une URL de base et une clé API (stockée en écriture seule, jamais renvoyée), vérifiée en
**listant les modèles** du fournisseur. Chaque tâche IA a son propre **modèle** et un **prompt**
éditable :

- **Photo → macros** — depuis le journal des repas, importe une à quatre photos du plat (plus une
  note optionnelle) et un modèle de vision estime les macros ; le prompt par défaut est légèrement
  pessimiste (préfère une petite surestimation).
- **Propositions de repas** — demande des aliments et quantités qui complètent la **plage cible
  restante** du jour ; les propositions tiennent compte de ce que tu as déjà mangé, sont
  **affinables** (épingler et ajuster les quantités) et affichent un état « déjà dans la cible »
  quand il n'y a rien à ajouter.

Un champ partagé **allergies / aliments non désirés** oriente à la fois les propositions de repas
et les conseils (ci-dessous) à l'écart des aliments que tu évites, et chaque tâche affiche un
**coût estimé par requête** sur les modèles courants, pour éviter les mauvaises surprises de
facturation.

Toute la fonctionnalité est **optionnelle** : Macronome fonctionne pleinement sans elle, et rien
ne quitte ton serveur tant que tu n'as pas configuré de connexion.

### Conseils IA — coaching IA

Une page dédiée transforme tes propres données en **conseils écrits**. À la demande — un appel
modèle payant par clic — un modèle de texte lit un condensé anonymisé de ta situation (profil et
chiffres métaboliques, cibles actuelles et passées, ta tendance de poids / IMC / tour de taille,
apports glissants, assiduité mensuelle sur tout l'historique, et les 30 derniers jours de journal
et de repas) et répond en **Markdown**, dans la langue de l'interface. Il juge l'équilibre **sur ta
moyenne, pas repas par repas**, et signale des **risques de carence** qualitatifs déduits des noms
d'aliments (peu de sources d'oméga-3 / poisson gras, peu de fibres…) — toujours avec l'avertissement
honnête que Macronome ne suit que les calories et les macros, **pas les micronutriments**. Chaque
génération est **archivée** sous forme de carte repliable (suppression derrière une confirmation).
Elle réutilise ta connexion IA avec son propre modèle et son prompt éditable. Les conseils envoient
délibérément plus de tes données que les autres usages IA ; ils n'envoient jamais d'identifiants,
les données d'autres utilisateurs, ni tes commentaires libres.

### Intégrations — services du réseau local

Connecte des services de ton propre réseau. Leurs secrets restent **côté serveur** (le navigateur
ne leur parle jamais directement), ils fonctionnent donc aussi quand tu es loin de chez toi.

- **Home Assistant** — importe ta dernière mesure de balance connectée. Indique à Macronome l'URL
  de ton Home Assistant, un jeton longue durée et l'entity id du capteur de poids ; un bouton
  **« Importer depuis HA »** pré-remplit alors une pesée avec la mesure arrondie (SI, kg uniquement).
- **BarclaudeGateway** — une passerelle auto-hébergée vers une base de produits d'épicerie
  (Chronodrive). Une fois configurée, une **recherche de produits** apparaît dans le modal d'ajout
  d'aliment et pré-remplit le nom d'un aliment et ses macros pour 100 g depuis un produit scanné.

### Paramètres — paramètres

Thème, langue et structure de journée par défaut (les repas et le nombre de lignes affichées par
repas). La section **Données** exporte tout ton contenu dans un fichier JSON versionné, en
**réimporte** un (remplacement/restauration complet), ou **efface** toutes les données suivies —
les identifiants ne sont jamais exportés ni effacés.

Une **sauvegarde Google Drive automatique** optionnelle envoie ce même export vers **ton propre**
Drive : apporte ton propre client OAuth Google, connecte-toi une fois, puis définis une fenêtre de
rétention et une heure quotidienne — déclenchée à **ton** heure locale, à moins d'une minute près —
plus une sauvegarde manuelle « Sauvegarder maintenant ». Attention : le fichier de sauvegarde
**n'est pas chiffré** et contient tes secrets stockés (jetons Drive / IA / Home Assistant) en clair,
alors garde ce dossier Drive privé ; la connexion nécessite de servir l'app en HTTPS.

### Utilisateurs — comptes (admin)

Les administrateurs disposent d'une page **Utilisateurs** pour gérer les comptes : le rôle et
l'usage de chaque compte (créé le, dernière connexion, dernière activité), **inviter** un nouvel
utilisateur via un lien à usage unique valable 7 jours (en choisissant son rôle), générer un **lien
de réinitialisation du mot de passe**, promouvoir / rétrograder des administrateurs, ou supprimer un
compte (ce qui **efface les données de ce compte**). Des garde-fous conservent au moins un
administrateur et t'empêchent d'agir sur ta propre ligne. Il n'y a **aucune inscription ouverte** —
chaque compte vient du propriétaire ou d'une invitation admin — et **un administrateur ne voit
jamais les données nutrition ou poids d'un autre utilisateur**, seulement les métadonnées du compte.

### Compte / À propos

Gère les identifiants et ton profil métabolique (sexe, date de naissance, taille) ; consulte la
version de l'application et des diagnostics serveur en direct (Node.js, uptime, OS, CPU, mémoire,
taille de la base).

### Configuration initiale & connexion

Sur une installation neuve, un **assistant de configuration au premier lancement** crée le compte
propriétaire (administrateur). Ensuite, les nouveaux comptes ne viennent que d'un **lien
d'invitation admin** — un lien à usage unique valable 7 jours qui ouvre le même assistant — donc
**aucune inscription publique**. La connexion est limitée en débit avec temporisation de
verrouillage et te garde connecté au fil des redémarrages ; la récupération du mot de passe passe
par un **lien de réinitialisation généré par un admin**, pas par un « mot de passe oublié » en
libre-service.

---

## Comment ça marche (comportements clés)

- **Calcul côté serveur** — l'application web lit des valeurs calculées ; elle ne recalcule jamais
  un chiffre nutritionnel.
- **Instantanés figés** — les jours passés conservent leurs instantanés de cibles + macros ; les
  modifications ultérieures n'affectent que les jours futurs.
- **Verdict auto basé sur les calories** avec surcharge manuelle ; les tuiles de macros sont des
  indicateurs de qualité, pas des déclencheurs de verdict.
- **Unités SI** partout, avec un arrondi d'affichage cohérent.
- **i18n** (FR/EN) pour les chaînes d'interface ; les noms d'aliments/recettes/portions restent tes
  données.
- **Auto-hébergement multi-utilisateur** — un administrateur propriétaire plus des comptes invités
  isolés, sans inscription publique ; tu places ton propre reverse proxy / TLS devant.

---

## Installer comme une app (mobile & bureau)

L'interface de Macronome est **responsive**, et c'est une **PWA** installable : sur téléphone comme
sur ordinateur, elle se lance dans sa propre fenêtre (sans barre du navigateur), la barre d'état /
la barre de titre du système suivant le thème clair/sombre de l'app. Les nouvelles versions
s'installent en silence et s'appliquent au prochain lancement.

**Sur ton téléphone :**

- **Android / Chrome (Chromium) :** ouvre l'app, puis touche le bouton **Installer l'app** dans
  **Paramètres → Mise à jour**, ou utilise le menu du navigateur **« Ajouter à l'écran d'accueil /
  Installer l'application »**.
- **iPhone / iPad (Safari) :** ouvre l'app, touche **Partager**, puis **« Sur l'écran d'accueil »**.

Une fois installée, elle fonctionne comme une app native. Deux atouts mobiles : prends une **photo
d'un plat** pour l'estimation IA des macros, et un léger **retour haptique** sur les actions clés.

![Macronome sur mobile](docs/img/preview_mobile.png)

**Sur ton ordinateur (Chrome / Edge) :** ouvre l'app et clique l'icône **Installer** dans la barre
d'adresse, ou le menu du navigateur → **« Installer Macronome »**. Elle s'ouvre dans une fenêtre de
bureau autonome, avec un **menu clic droit** natif et des **raccourcis** d'app pour naviguer vite.

![Macronome installé sur ordinateur](docs/img/preview_pc.png)

---

## Pile technique

Monorepo npm-workspaces (`shared` · `api` · `web`) · **Node 22** + TypeScript + **Express 5** ·
**PostgreSQL 17** + **Prisma** · **React 18** + **Vite 6** · **Zod** · **i18next** · sessions
côté serveur (**argon2id**) · **Vitest** + **Playwright** · **Docker**.

Le processus API sert **à la fois** le SPA statique et `/api/v1` sur un seul port, donc la
production tient en une image prête à l'emploi.

---

## Installation — Docker (recommandé)

Macronome est livré comme une image prête à l'emploi sur GHCR et s'exécute **sans configuration** :
chaque réglage a une valeur par défaut sûre. Voir [`compose.yml`](compose.yml).

```bash
# Dans un dossier contenant compose.yml :
docker compose up -d
```

Cela télécharge `ghcr.io/machintrucbidule/macronome:latest` et démarre deux services — l'application
et `postgres:17` — avec les données sur des volumes nommés gérés par Docker (`pgdata` pour la base,
`appdata` pour le secret de session auto-généré et la boîte noire d'authentification). L'application écoute sur le **port 3000** (port
hôte défini par `APP_PORT`). Le point d'entrée du conteneur exécute `prisma migrate deploy` puis
démarre le serveur. Dans **Portainer**, colle le même fichier comme stack et « deploy ».

**Premier lancement.** Ouvre l'application dans un navigateur et complète l'**assistant de
configuration** pour créer le compte propriétaire unique. En secours CLI (par ex. headless) :

```bash
npm run create-user -w @macronome/api -- \
  --username toi --password 'secret' --sex male --birthdate 1990-01-01 --height 180
```

**Reverse proxy / TLS.** L'application sert du HTTP en clair sur son port — place ton propre reverse
proxy devant (Nginx Proxy Manager, Traefik, Caddy, Cloudflare Tunnel…) qui termine le TLS. La sonde
de santé est `GET /api/v1/health`. Les cookies sont marqués `Secure` automatiquement dès que la
requête est vue en HTTPS — rien à configurer, puisque le `TRUSTED_PROXY` par défaut fait déjà
confiance à un proxy sur le même hôte ou en conteneur Docker (restreins `TRUSTED_PROXY` pour durcir).

**Si une connexion échoue un jour sans que tu saches pourquoi.** Chaque tentative en échec ajoute
une ligne à `/data/auth_failures.jsonl` sur le volume `appdata`, qui consigne ce que le serveur a
réellement vu (HTTPS ou non, quels cookies sont arrivés, si le cookie a été émis) — et elle survit
à la recréation du conteneur. L'écran de connexion affiche un code de diagnostic court désignant la
ligne correspondante. Lis le fichier avec
`docker run --rm -v macronome_appdata:/data alpine tail -n 20 /data/auth_failures.jsonl`.

**Sauvegardes.** Le seul état critique est le volume `pgdata` — sauvegarde-le (par ex. `pg_dump`)
avant les mises à jour. Au niveau des données, Macronome propose aussi un **export/import JSON**
in-app et une **sauvegarde Google Drive automatique** optionnelle (les deux dans les Paramètres) —
pratiques, mais ils ne remplacent pas une sauvegarde du volume / de la base.

### Configuration (tout est optionnel — valeurs par défaut indiquées)

Copie [`.env.example`](.env.example) vers `.env` et ne décommente que ce que tu veux surcharger.

| Variable            | Défaut                  | Rôle                                                                                                                                                                                     |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MACRONOME_TAG`     | `latest`                | Tag d'image à déployer (`latest` ou `vX.Y.Z`).                                                                                                                                           |
| `APP_PORT`          | `3000`                  | Port hôte mappé sur l'application.                                                                                                                                                       |
| `POSTGRES_DB`       | `macronome`             | Nom de la base.                                                                                                                                                                          |
| `POSTGRES_USER`     | `macronome`             | Utilisateur de la base.                                                                                                                                                                  |
| `POSTGRES_PASSWORD` | `macronome`             | Mot de passe (Postgres est interne, non exposé).                                                                                                                                         |
| `SESSION_SECRET`    | _(auto-généré)_         | Clé de signature des cookies ; générée et persistée au 1er boot si absente.                                                                                                              |
| `COOKIE_SECURE`     | `auto`                  | `auto` marque les cookies `Secure` seulement quand la requête est vue en HTTPS ; `true` le force (casse la connexion si `TRUSTED_PROXY` ne couvre pas ton proxy) ; `false` le désactive. |
| `TRUSTED_PROXY`     | `loopback, uniquelocal` | Pairs de confiance pour `X-Forwarded-*` (IP client réelle + cookies Secure) ; le défaut couvre un proxy conteneur Docker.                                                                |

---

## Installation — manuelle (sans Docker)

Prérequis : **Node ≥ 22** et un **PostgreSQL 17** accessible.

```bash
# 1. Installer les dépendances
npm install

# 2. Générer le client Prisma
npm run prisma:generate -w @macronome/api

# 3. Tout construire (shared → api → web)
npm run build

# 4. Configurer l'environnement (exemple)
export DATABASE_URL="postgresql://user:password@localhost:5432/macronome"
export NODE_ENV=production
export WEB_DIST="$(pwd)/packages/web/dist"   # chemin absolu vers le SPA construit
export PORT=3000                              # optionnel
# export SESSION_SECRET="..."                 # optionnel ; auto-généré et persisté si absent

# 5. Appliquer les migrations de base de données
npm run migrate

# 6. Démarrer le serveur (sert le SPA + /api/v1 sur PORT)
npm run start -w @macronome/api
```

Le processus API unique sert le SPA construit depuis `WEB_DIST` et les endpoints `/api/v1` sur le
même port (voir [`packages/api/src/http/spa.ts`](packages/api/src/http/spa.ts)). Ouvre
`http://localhost:3000` et complète l'assistant de configuration (ou utilise le script `create-user`
ci-dessus). Place ton propre reverse proxy HTTPS devant pour une exposition sur Internet.

---

## Environnement de développement

```bash
# 1. Installer
npm install

# 2. Démarrer une base de dev locale (persistante, Postgres sur le port 5434)
docker compose -f compose.dev.yml up -d

# 3. Pointer l'API dessus — crée packages/api/.env :
#    DATABASE_URL=postgresql://macronome:dev@localhost:5434/macronome

# 4. Générer le client Prisma, puis appliquer les migrations
npm run prisma:generate -w @macronome/api
npm run migrate

# 5. Lancer l'API et le serveur de dev web (deux terminaux)
npm run dev:api    # API Express sur http://127.0.0.1:3000
npm run dev:web    # SPA Vite sur http://127.0.0.1:5173 (proxy /api → 3000)
```

Ouvre **http://127.0.0.1:5173**. Les deux côtés se rechargent à chaud.

> Génère le client Prisma **avant** `lint`/`typecheck` — les règles typées et `tsc` ont besoin du
> client généré.

### Contrôles qualité

| Tâche                 | Commande                                                         |
| --------------------- | ---------------------------------------------------------------- |
| Vérification de types | `npm run typecheck`                                              |
| Lint                  | `npm run lint`                                                   |
| Tests unitaires       | `npm test`                                                       |
| Tests d'intégration   | `npm run db:dev` (base de test sur 5433) puis `npm run test:int` |
| Tests end-to-end      | `npm run e2e`                                                    |
| Tout construire       | `npm run build`                                                  |

`npm run db:dev` démarre la base de test **éphémère** (Postgres sur **5433**) ; la base de dev de
`compose.dev.yml` est distincte (**5434**) afin que les deux puissent tourner en même temps.

---

## Structure du projet

| Chemin            | Ce que c'est                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | Schémas Zod (DTO) + types et constantes du domaine (énergie 9/4/4, multiplicateurs d'activité…). Aucune logique.                |
| `packages/api`    | Backend Express + Prisma — le **seul** endroit où vit la logique métier (`domain` · `services` · `data/repositories` · `http`). |
| `packages/web`    | SPA React + Vite. **Affiche, ne calcule jamais.** Un dossier par écran sous `features/`.                                        |
| `packages/etl`    | Stub historique de migration Excel → BD, **remplacé** par l'import in-app (Paramètres → import). Non construit/exécuté.         |

Le produit est défini par des **contrats** fixes, synchronisés via git : `spec/` (schéma de
données, API, logique métier avec exemples numériques travaillés), `design/` (tokens + composants
de design) et `DECISIONS.md`. La documentation d'architecture vit dans `ARCHITECTURE.md` +
`docs/architecture/`.
