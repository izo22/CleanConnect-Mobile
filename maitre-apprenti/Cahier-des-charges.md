# Maître & Apprenti — Cahier des charges

**Version 2.1 — 30 septembre 2026**  
**Statut : prototype complet, prêt pour un pilote avec un artisan**  
**Nom commercial : à choisir (piste principale : Kataya, marque à vérifier)**

---

## 1. Objet

### 1.1 Le problème
Les métiers manuels (boulangerie, cuisine, artisanat, maintenance, industrie) manquent de temps pour former. Le maître montre un geste une fois ; l'apprenti le refait seul, sans personne pour lui dire ce qui ne va pas. Les vidéos (YouTube, tutoriels) montrent, mais ne corrigent pas.

### 1.2 Positionnement

> **Nous capturons le savoir-faire des meilleurs formateurs et permettons à l'IA de l'utiliser pour accompagner chaque apprenti.**

On ne vend pas « une IA qui corrige des gestes ». Chaque leçon est **le savoir d'un maître**, mis sous une forme exploitable : ses gestes filmés, ses explications, ses légendes et ses règles de correction. L'IA ne fait qu'appliquer ce savoir à chaque apprenti. La valeur s'accumule chez le client (B2B : centres de formation, réseaux d'artisans, industriels), leçon après leçon.

### 1.3 La solution
1. **Le maître filme son geste une seule fois** (téléphone, lunettes connectées, ou vidéo existante).
2. **L'IA en fait une leçon** : étapes, consignes, fiche écrite, clips, images de référence.
3. **L'apprenti refait le geste devant son téléphone** (ou avec des lunettes). Quand il dit « vérifie », l'IA compare son geste à celui du maître et lui dit quoi corriger, à l'oreille. Pour certaines erreurs simples, le téléphone l'alerte en direct, sans IA.

### 1.4 Ce qui la distingue
- La **correction du geste lui-même** (sens, ordre, position des mains, résultat), pas seulement une vidéo à regarder.
- Un **simple téléphone sur un support** suffit ; les lunettes sont une option.
- Le **maître reste le juge** : il relit la fiche, légende les images, juge les corrections de l'IA et lui donne des règles qu'elle applique aussitôt.
- **Tout se pilote à la voix**, mains prises.

---

## 2. Utilisateurs

| Rôle | Ce qu'il fait |
|---|---|
| **Maître** | Filme sa démonstration, relit et corrige la fiche, légende les images, partage la leçon (QR code), juge les corrections de l'IA, donne des règles. |
| **Apprenti** | Choisit une leçon (ou scanne le QR code), installe son téléphone, refait les gestes, demande « vérifie », suit les corrections. |
| **Responsable du pilote** | Suit les mesures (justesse, coût, durée) sur la page d'évaluation. En pratique, souvent le maître lui-même. |
| **Administrateur** | Installe et héberge le serveur (le « cerveau »), fournit la clé API et la clé d'accès. |

---

## 3. Périmètre

### 3.1 Dans le périmètre (fait)
- Création de leçon depuis une vidéo, un téléphone, des lunettes Mentra Live ou Meta Ray-Ban Display.
- Fiche écrite modifiable et imprimable, images légendées par le maître.
- Partage par QR code.
- Séance apprenti sur téléphone ou tablette (4 écrans), ou avec lunettes.
- Vérification à la demande par l'IA, alertes instantanées sans IA, surveillance continue d'étapes sensibles.
- Commandes vocales, lecture à voix haute, ralenti, miroir.
- Évaluation par le maître, règles du maître, mesures du pilote (justesse, coût, temps).

### 3.2 Hors périmètre du pilote (plus tard)
Comptes utilisateurs et entreprises, base de données, paiement, interface en anglais, publication sur les stores, conformité RGPD complète, hébergement de production.

---

## 4. Parcours utilisateurs

### 4.1 Le maître crée une leçon
1. Accueil → **« Je suis le maître »** → **« Filmer une nouvelle leçon »**.
2. Il écrit le geste qu'il va montrer (« Baguette de tradition ») et son métier (retenu pour la fois suivante).
3. **Ouvrir la caméra** → le téléphone vérifie l'installation (lumière, netteté, stabilité) et donne un conseil concret si besoin.
4. **Commencer l'enregistrement** : il travaille en expliquant à voix haute ; il dit « étape suivante » à chaque étape et « terminé » à la fin (ou utilise les gros boutons). Sa voix est transcrite.
5. Écran d'attente (quelques minutes) → **« Ta leçon est prête »** :
   1. **Relire la fiche** (et la corriger) ;
   2. **Faire scanner le QR code** à l'apprenti (ou envoyer / copier le lien).

Variantes : envoyer une vidéo déjà filmée (avec des astuces écrites), ou filmer avec les lunettes Mentra ou Meta (mode maître de l'appli lunettes).

### 4.2 L'apprenti suit une leçon (téléphone sur un support)
1. Il **scanne le QR code** (ou Accueil → « Je suis l'apprenti » → choisit la leçon).
2. **Ton prénom** → Continuer.
3. **Installation** : « Pose ton téléphone sur le support ». La première image du maître s'affiche en transparence pour caler l'angle ; la vérification automatique donne une coche verte ou un conseil → **C'est parti !**
4. **L'atelier** (une étape à la fois) : numéro d'étape, titre en très gros, consigne, vidéo du maître en boucle, bouton géant **« Vérifier mon geste »**, boutons Retour / Comment faire / Suivant.
5. Il fait le geste, puis dit **« vérifie »** : écran bleu « Je regarde… », puis la réponse (orange = correction, vert = bravo et étape suivante, « rien de faux » sinon).
6. **« Bravo, tu as terminé ! »** → recommencer ou choisir une autre leçon.

### 4.3 Avec des lunettes
- **Mentra Live** : la vidéo part en direct (RTMP) ; voix des lunettes ; bouton (appui court : démarrer puis vérifier ; appui long : suivant).
- **Meta Ray-Ban Display** : le téléphone Android garde les 20 dernières secondes et les envoie avec « vérifie » ou « suivant » ; l'écran des lunettes affiche l'étape, la correction et les boutons « Vérifier mon geste », « Voir le geste », « Répéter », « Étape suivante ».
- Si la page apprenti est ouverte sur une tablette, elle suit la séance des lunettes toute seule.

### 4.4 Le maître évalue et corrige l'IA
Page « Juger l'IA » : il voit chaque réponse de l'IA avec les 8 images qu'elle a vues, la juge (juste, fausse, inutile ; erreur ratée), et peut transformer son explication en **règle** que l'IA applique dès la réponse suivante.

---

## 5. Exigences fonctionnelles

Statut : ✅ fait et testé · 🧪 fait, à valider sur le terrain · ⏳ à faire.

### 5.1 Création de la leçon

| N° | Exigence | Statut |
|---|---|---|
| EF-01 | Accepter une vidéo envoyée (fichier), une démonstration filmée au téléphone (morceaux de 10 s avec le son), des morceaux vidéo HEVC des lunettes Meta, un direct RTMP des lunettes Mentra. | ✅ |
| EF-02 | Transcrire la voix du maître (téléphone, lunettes) et enregistrer ses repères « étape suivante ». | ✅ |
| EF-03 | Extraire 1 image par seconde de la vidéo (au plus 80) et demander à l'IA de découper la démonstration en étapes (en général 4 à 12). | ✅ |
| EF-04 | Pour chaque étape, produire : titre (2 à 6 mots), consigne (lue à voix haute), explication détaillée (2 à 5 phrases), points de contrôle, erreurs fréquentes, critères de réussite, début et fin dans la vidéo, mouvement des mains attendu (s'écartent / se rapprochent / libre). | ✅ |
| EF-05 | Découper pour chaque étape un clip tablette (720p avec son) et un clip lunettes (266×150 sans son). | ✅ |
| EF-06 | Produire 8 images de référence par étape, recadrées automatiquement sur la zone des mains, et une image entière de début d'étape (guide de placement). | ✅ |
| EF-07 | Ranger avec chaque étape ce que le maître a dit pendant cette étape. | ✅ |
| EF-08 | Signaler l'état de la leçon (en préparation, prête, erreur) ; en cas d'échec, afficher la raison. | ✅ |

### 5.2 Fiche écrite et édition par le maître

| N° | Exigence | Statut |
|---|---|---|
| EF-10 | Afficher toutes les étapes en texte : consigne, explication, points clés, à éviter, « c'est réussi quand », « le maître dit », et « le geste en images » (8 images légendées). | ✅ |
| EF-11 | Permettre au maître de modifier titre, consigne, explication, listes, et d'écrire une légende sous chaque image de référence (200 caractères au plus). | ✅ |
| EF-12 | Permettre au maître de régler l'alerte instantanée de chaque étape (aucune, mains qui s'écartent, mains qui se rapprochent). | ✅ |
| EF-13 | Transmettre les modifications aux séances en cours, sans les interrompre ; l'IA s'appuie sur le texte et les légendes du maître. | ✅ |
| EF-14 | Version imprimable de la fiche. | ✅ |

### 5.3 Partage

| N° | Exigence | Statut |
|---|---|---|
| EF-20 | Générer un QR code menant directement à la leçon (avec la clé d'accès s'il y en a une). | ✅ |
| EF-21 | Boutons « Envoyer le lien » (partage du téléphone) et « Copier le lien ». | ✅ |
| EF-22 | Prévenir le maître si la page est ouverte en local (le QR code ne marcherait pas sur un autre téléphone). | ✅ |

### 5.4 Séance de l'apprenti

| N° | Exigence | Statut |
|---|---|---|
| EF-30 | Quatre écrans : prénom → installation → atelier → fin. Le prénom est retenu sur l'appareil. | ✅ |
| EF-31 | Contrôle de l'installation à l'ouverture de la caméra : lumière (trop sombre, trop claire, contre-jour), netteté, stabilité du téléphone, image noire. Un conseil concret par problème, puis plus rien pendant la leçon. | 🧪 seuils à régler |
| EF-32 | Guide de placement : première image du maître en transparence, cadre aux mêmes proportions. | ✅ |
| EF-33 | Filmer en continu et garder les 20 dernières secondes en mémoire, à 4 images par seconde au moins, **sans appeler l'IA**. | ✅ |
| EF-34 | **« Vérifie »** : prendre la tentative (1,5 fois la durée de l'étape chez le maître, entre 4 et 20 s), en choisir 4 moments de 2 images à un quart de seconde d'écart, datées, recadrées sur les mains, et les faire comparer par l'IA aux 8 images du maître et à la fiche de l'étape. Toujours répondre : correction, bravo (et étape suivante), « rien de faux », ou « je ne vois pas bien ». | ✅ |
| EF-35 | **« Suivant »** : l'IA vérifie d'abord la dernière tentative ; en cas d'erreur, elle la dit et propose de redire « suivant » pour passer quand même. Sans vidéo de l'étape, on passe directement. | ✅ |
| EF-36 | **Vérification automatique** (option de la leçon, désactivée par défaut) : repérer sans IA la fin d'un geste (3 s de mouvement puis 1,5 s d'immobilité) et vérifier une fois. | 🧪 |
| EF-37 | **Étapes surveillées** (couteau, four…, cochées par le maître) : analyse continue toutes les 2 secondes, l'apprenti en est prévenu. | ✅ |
| EF-38 | **Alertes instantanées sans IA** : suivi des deux mains sur le téléphone (MediaPipe) ; si elles vont dans le mauvais sens de façon régulière pendant environ 1 s, alerte immédiate (écran orange, voix, vibration). Replacements rapides et tremblements ignorés ; pause de 6 s entre deux alertes ; téléphone lent : observation jusqu'à 4 s et avertissement. | 🧪 vitesse à mesurer sur téléphone |
| EF-39 | Couleur de toute la page selon la réponse : bleu (je regarde), orange (correction), vert (bravo). Le bravo reste 4 secondes. | ✅ |
| EF-40 | Commandes vocales : « vérifie » (« regarde », « c'est bon ? »), « suivant », « précédent », « explique », « répète », « recommence », « montre le geste », « ralenti » (« doucement »), « vitesse normale ». Le téléphone n'écoute pas sa propre voix. | ✅ (reconnaissance vocale réelle à valider) |
| EF-41 | Lecture à voix haute des consignes et des corrections (réglable). | ✅ |
| EF-42 | Vidéo du maître : son, vitesse 1× / ½× / ¼×, miroir gauche-droite (retenu sur l'appareil). | ✅ |
| EF-43 | « Comment faire » : explication, points clés, à éviter, réussite, paroles du maître, images légendées, plan de la leçon, lien vers la fiche. | ✅ |
| EF-44 | Réglages derrière ⚙ : voix, commandes vocales, miroir, alertes instantanées, replacer le téléphone, recommencer, quitter. | ✅ |
| EF-45 | Écran gardé allumé pendant la leçon. | ✅ |
| EF-46 | Une commande envoyée avec un morceau de vidéo trop court ne doit jamais être perdue. | ✅ |

### 5.5 Lunettes connectées

| N° | Exigence | Statut |
|---|---|---|
| EF-50 | Appli Mentra (cloud) : direct RTMP, commandes vocales, bouton, affichage, voix ; modes maître et apprenti ; page de réglages. | ✅ (lunettes réelles à valider) |
| EF-51 | Appli Android Meta (DAT 1.0) : vidéo HEVC découpée, tampon de 20 s, envoi avec « vérifie » / « suivant », écran des Ray-Ban Display, voix du téléphone. | ✅ compile · APK à construire |
| EF-52 | Ralenti de la vidéo du maître sur l'écran des lunettes Meta (clip lent préparé à l'avance). | ⏳ |

### 5.6 Évaluation et règles du maître

| N° | Exigence | Statut |
|---|---|---|
| EF-60 | Journal de chaque analyse de l'IA (images vues, verdict, message, ce qui l'a déclenchée, temps de réponse, coût). | ✅ |
| EF-61 | Avis du maître : juste / fausse / inutile (corrections), juste / validée à tort (bravos), rien à dire / erreur ratée (silences). | ✅ |
| EF-62 | Une explication du maître peut devenir une règle (pour l'étape ou toute la leçon), appliquée dès l'analyse suivante, y compris dans les séances en cours. | ✅ |
| EF-63 | Mesures du pilote : corrections justes / fausses / inutiles, erreurs ratées, séances terminées, durée médiane, temps médian par étape, coût par heure, par séance et par analyse, temps de réponse, ce qui a déclenché les analyses. | ✅ |
| EF-64 | Réglages « quand l'IA regarde » : vérification automatique, étapes surveillées, cadence des étapes surveillées (2 à 5 images/s). | ✅ |

---

## 6. L'intelligence artificielle

### 6.1 Principe
Il ne s'agit pas de mesurer des coordonnées : un modèle d'IA qui comprend les images (Claude, d'Anthropic) **compare les images de l'apprenti à celles du maître, comme le ferait un formateur**, en s'appuyant sur la fiche de l'étape (points de contrôle, erreurs fréquentes, critères de réussite), les légendes et les règles du maître.

### 6.2 Deux usages
| Usage | Quand | Entrées | Sortie |
|---|---|---|---|
| Préparer la leçon | une fois par leçon | jusqu'à 80 images datées de la démonstration, paroles et repères du maître, ses astuces | étapes structurées (voir EF-04) |
| Juger une tentative | à chaque « vérifie », « suivant », vérification automatique ou surveillance | 8 images du maître (en cache), fiche de l'étape, règles et légendes du maître, conseils déjà donnés, 8 images datées de l'apprenti | verdict (correction, étape réussie, en cours, pas visible) + message de 15 mots au plus |

### 6.3 Règles de jugement données à l'IA
- Regarder le mouvement d'une image à l'autre (sens, amplitude, ordre, rythme), surtout entre images rapprochées.
- Ne juger que ce qui se voit (ni pression, ni texture).
- Deux cas sont des erreurs même si chaque geste ressemble à celui du maître : un résultat qui se défait au lieu de se former, et le geste d'une autre étape.
- Sinon, dans le doute, ne pas corriger : une correction fausse fait plus de mal qu'un silence.
- Les règles du maître priment sur son propre jugement.
- Quand l'apprenti demande, toujours répondre (ce qui est bien, ce qu'il reste à faire).

### 6.4 Mesures réelles (septembre 2026, vraie démonstration de façonnage de baguette)
| Mesure | Résultat |
|---|---|
| Préparation d'une leçon de 30 s | 46 s, 7 étapes justes |
| Justesse sur 10 cas avec réponse attendue | 7/10 avec 8 images régulières → **10/10, deux fois de suite**, avec les paires d'images rapprochées et les deux règles précisées |
| Temps de réponse à « vérifie » | 4,5 à 6 s |
| Coût d'une vérification | 0,016 à 0,026 $ |
| Coût d'une heure de pratique | environ 1 à 1,5 $ à la demande ; 10 à 15 $ en surveillance continue |
| Coût de préparation d'une leçon | environ 0,25 $ (estimation) |
| Alertes instantanées (sans IA), image par image | geste juste : aucune ; geste à l'envers : alerte à 1,6 s ; autres étapes : aucune fausse alerte ; coût 0 $ |

Limite de ces mesures : les « apprentis » étaient des extraits de la vidéo du maître (mêmes mains, même angle).

### 6.5 Modèle et réglages
Modèle par défaut `claude-opus-5-5` (variable `MODELE_IA` ; Sonnet ou Haiku possibles, moins chers, justesse à comparer). Réponses au format JSON imposé ; effort de réflexion bas pour répondre vite (un effort plus élevé n'améliorait pas la justesse et doublait le temps) ; images du maître mises en cache pendant l'étape.

---

## 7. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| **Réactivité** | Réponse à « vérifie » en 5 s environ ; alerte instantanée en 1 à 2 s (téléphone récent) ; accusé « Je regarde » immédiat. |
| **Coût** | L'IA ne regarde que quand il le faut ; filmer et garder la vidéo ne coûte rien ; coût réel mesuré et affiché. |
| **Simplicité** | Un écran = une chose à faire ; texte lisible à un mètre ; bouton principal géant ; aucun réglage obligatoire ; tout à la voix. |
| **Compatibilité** | Navigateur récent (Chrome, Safari) ; **HTTPS obligatoire** pour la caméra et le micro ; reconnaissance vocale : Chrome et Safari (pas Firefox) ; mode sombre. |
| **Accessibilité** | Vrais boutons et étiquettes, contrastes suffisants, états annoncés aux lecteurs d'écran, animations réduites si demandé. |
| **Sécurité** | Clé d'accès partagée pour l'API (`CLE_ACCES`, en-tête ou paramètre) ; adresses RTMP à clé aléatoire ; les médias des leçons ne sont pas protégés par la clé (adresses difficiles à deviner mais pas secrètes). |
| **Vie privée** | La vidéo va au serveur, des images vont à l'API de l'IA ; le suivi des mains se fait sur le téléphone ; prévenir les personnes filmées ; pas de clients ni de documents dans le champ. |
| **Robustesse** | Une vidéo illisible ou une IA indisponible ne bloquent pas la séance ; une séance inactive 2 h est oubliée ; le journal s'écrit sans ralentir la séance. |

---

## 8. Architecture technique

### 8.1 Composants
| Composant | Technologie | Rôle |
|---|---|---|
| **Cerveau** (`cerveau/`) | Node.js 22.6 ou plus (TypeScript), ffmpeg, SDK Anthropic, qrcode | API, préparation des leçons, séances, IA, journal, pages web |
| **Pages web** (`cerveau/public/`) | HTML, CSS, JavaScript sans framework ; MediaPipe (suivi des mains) | Accueil, maître, apprenti, fiche, évaluation |
| **Appli Mentra** (`lunettes-mentra/`) | Bun, SDK Mentra (cloud) | Lunettes Mentra Live |
| **Appli Meta** (`lunettes-meta/`) | Android, Kotlin, Meta Wearables DAT 1.0 | Lunettes Meta Ray-Ban Display |

### 8.2 Données (fichiers sur le serveur)
- `donnees/lecons/<id>/lecon.json` : la leçon et ses étapes ; `images/` ; `clips/` ; `source-video`.
- `donnees/seances/<id>/seance.json`, `interventions/*.json`, `images/*.jpg` : le journal.
- Séances en cours : en mémoire (un seul serveur).

**Leçon** : id, titre, métier, source, statut, étapes, règles du maître, cadence, vérification automatique.
**Étape** : numéro, titre, consigne, explication, points de contrôle, erreurs fréquentes, critères de réussite, début/fin, clips, 8 images de référence, légendes, image guide, paroles du maître, mouvement des mains, étape surveillée.

### 8.3 API (préfixe `/api`, clé d'accès si configurée)
| Méthode et route | Rôle |
|---|---|
| `GET /lecons` · `POST /lecons` | Lister · créer depuis une vidéo |
| `GET /lecons/:id` · `DELETE /lecons/:id` | Lire · supprimer |
| `POST /lecons/:id/etapes/:id` | Modifier le texte, les légendes, le mouvement des mains d'une étape |
| `POST /lecons/:id/reglages` | Cadence, vérification automatique, étapes surveillées |
| `POST /lecons/:id/regles` · `DELETE /lecons/:id/regles/:id` | Règles du maître |
| `GET /lecons/:id/seances` · `GET /lecons/:id/metriques` | Séances · mesures du pilote |
| `GET /seances/:id` · `GET /seances/:id/images/:id` | Journal d'une séance · images vues par l'IA |
| `POST /seances/:id/interventions/:id/annotation` | Avis du maître (et règle) |
| `POST /captures` · `/captures/:id/video` · `/direct` · `/parole` · `/etape` · `/terminer` | Démonstration filmée (téléphone, lunettes) |
| `POST /sessions` · `GET /sessions` · `GET /sessions/:id` | Séances d'apprentissage |
| `POST /sessions/:id/video` (`?commande=verifier|suivant`) | Vidéo de l'apprenti (gardée en mémoire, ou avec une commande) |
| `POST /sessions/:id/commande` | verifier, suivant, precedent, repeter, recommencer, expliquer |
| `POST` · `DELETE /sessions/:id/direct` | Direct RTMP (Mentra) |
| `GET /sessions/:id/evenements` | Flux d'événements (tablette, lunettes Mentra) |
| `GET /qr?texte=` | QR code (SVG) |

Hors API : `/media/lecons/:id/(images|clips)/:fichier` (lecture partielle pour les vidéos) ; `/vendor/mediapipe/…` (suivi des mains).

### 8.4 Configuration
`ANTHROPIC_API_KEY`, `MODELE_IA`, `CLE_ACCES`, `PORT` (8787), `DOSSIER_DONNEES`, `PORTS_RTMP`, `URL_RTMP_PUBLIQUE` ; `npm run modeles` (modèle des mains, 8 Mo).

---

## 9. Tests et validation

| Partie | Tests automatiques |
|---|---|
| Cerveau | 65 (séances, vérification, paires d'images, recadrage, détection de fin de geste, alertes instantanées, commandes vocales, contrôle d'installation, serveur, parcours complets avec vraies vidéos et IA simulée, journal) |
| Appli Mentra | 10 (dont intégration avec le vrai cerveau et une vraie vidéo en direct) |
| Appli Meta | 19 (contrôleur, découpage vidéo HEVC) ; tout le code compile contre les vraies bibliothèques Meta |

**Comment les relancer.** Dans `code/cerveau` : `npm ci` puis `npm test`. Avant les tests, le script vérifie l'installation (version de Node, dépendances, ffmpeg) et dit quoi corriger s'il manque quelque chose. Il y a un piège connu : si ffmpeg n'a pas pu être téléchargé pendant l'installation (réseau filtré), il faut lancer `npm rebuild ffmpeg-static`.

**Versions vérifiées.** Les 65 tests passent sur une installation neuve (`npm ci`) avec Node 22.6, 22.16 et 22.22. La version 2.0 du dossier demandait Node 22.18 : sur une version plus ancienne, `npm test` échouait avant même de lancer les tests. C'est corrigé en 2.1. Un workflow GitHub (`.github/workflows/maitre-apprenti.yml`) relance les tests du cerveau à chaque envoi de code, sur Node 22.6, 22.16 et la dernière 22, ainsi que les tests Mentra. La vérification ne dépend donc plus d'une seule machine.

Vérifié aussi dans un vrai navigateur (caméra et micro simulés) : tournage du maître au téléphone, leçon prête et QR code, parcours apprenti complet, légendes, ralenti, contrôle d'installation, guide de placement, modes clair et sombre.

**Pas encore validé** : un vrai apprenti (autres mains, autre angle), la reconnaissance vocale réelle, la vitesse du suivi des mains sur un vrai téléphone, les vraies lunettes, l'APK Android complet, les seuils (contrôle d'installation, recadrage, vérification automatique).

---

## 10. Reste à faire

### 10.1 Avant le pilote
1. Choisir le nom et le logo ; coder le nouveau design (maquettes validées : côté maître clair et chaleureux, côté apprenti « atelier » sombre façon appli caméra).
2. Déplacer le projet dans son propre dépôt.
3. Héberger le cerveau en HTTPS (caméra, micro et QR code sur un autre téléphone).
4. Tester avec un vrai apprenti et régler les seuils.
5. (Si lunettes Meta) Ralenti sur les lunettes ; construire l'APK dans Android Studio.

### 10.2 Pour un produit commercial
Comptes par entreprise (maîtres, apprentis), base de données et stockage des vidéos, interface et IA en anglais, consentement et conservation des vidéos (RGPD, lois américaines), paiement et limite de coût IA par client, publication sur les stores, hébergement, sauvegardes, surveillance, historique des progrès de l'apprenti, réorganisation des étapes.

---

## 11. Critères de réussite du pilote

| Mesure (page d'évaluation) | Objectif proposé |
|---|---|
| Corrections jugées justes par le maître | ≥ 70 % |
| Corrections fausses | ≤ 15 % |
| Séances terminées | ≥ 60 % |
| Temps de réponse médian | ≤ 6 s |
| Coût IA par heure de pratique | ≤ 2 $ |
| Avis du maître | « je m'en servirais » |
| Test sans explication | un nouvel utilisateur fait une leçon sans aide |

---

## 12. Glossaire
- **Cerveau** : le serveur qui prépare les leçons et fait juger les gestes par l'IA.
- **Étape surveillée** : étape où l'IA regarde en continu (sécurité).
- **Vérification** : un regard de l'IA sur une tentative de l'apprenti (payant, environ 2 centimes).
- **Alerte instantanée** : alerte du téléphone, sans IA, sur le mouvement des mains (gratuite).
- **Paires rapprochées** : deux images à un quart de seconde d'écart, pour voir le sens du mouvement.
- **Règle du maître** : consigne donnée à l'IA par le maître, qui prime sur son jugement.
- **RTMP** : protocole de vidéo en direct (lunettes Mentra).
- **QR code** : code à scanner avec l'appareil photo pour ouvrir la leçon.
