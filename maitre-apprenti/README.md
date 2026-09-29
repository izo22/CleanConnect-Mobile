# Maître & Apprenti

Le maître filme ses gestes une fois (une baguette, un croissant, une soudure…). L'apprenti les refait avec des lunettes connectées qui le filment. Quand il dit **« vérifie »**, une IA compare son geste à celui du maître et le corrige à l'oreille, étape par étape. Chaque étape existe aussi **en texte** (fiche écrite relue par le maître).

Ça marche pour n'importe quel métier où il y a **un geste et un résultat visible**.

```
 MAÎTRE                                     APPRENTI
 vidéo (téléphone, lunettes)                lunettes Mentra (vidéo en direct)
 ou démonstration filmée avec les lunettes  lunettes Meta (morceaux de vidéo de 4 s)
                                            tablette (morceaux de vidéo de 4 s, test sans lunettes)
        │                                          │
        ▼                                          ▼
 ┌──────────────────────────── CERVEAU (serveur) ──────────────────────────────┐
 │ 1. découpe la démonstration en étapes (Claude) : consigne, points de        │
 │    contrôle, erreurs fréquentes, critères de réussite ; pour chaque étape    │
 │    un clip du maître et une séquence de référence (8 images de son geste)   │
 │ 2. pendant la leçon : garde la vidéo récente de l'apprenti (gratuit) ;     │
 │    quand il dit « vérifie » ou « suivant », envoie 8 images de sa tentative │
 │    à l'IA, qui les compare au geste du maître                               │
 │    → « correction », « étape réussie », « rien de faux », « je ne vois pas » │
 └─────────────────────────────────────────────────────────────────────────────┘
        │  correction à dire / afficher, étape suivante, clip à montrer
        ▼
 lunettes (voix + écran s'il y en a un) et tablette (clip du maître en boucle)
```

**Pourquoi « 8 images » ?** L'IA (Claude) ne lit pas un fichier vidéo directement : elle regarde une vidéo comme une suite d'images. Le cerveau prend donc 8 images réparties sur la tentative de l'apprenti, pour que l'IA juge le **mouvement** (sens, ordre, rythme) et pas une photo isolée.

**Pourquoi « à la demande » ?** Regarder la vidéo du maître ne coûte rien, aussi souvent qu'on veut. Ce qui coûte, c'est chaque regard de l'IA sur l'apprenti (environ 2 centimes). En analysant en continu, on arrive à 10 à 15 $ de l'heure ; à la demande, à environ 1 à 1,5 $ de l'heure.

## Contenu du dossier

| Dossier | Rôle | Langage |
|---|---|---|
| `cerveau/` | Serveur : leçons, IA, sessions, vidéo (morceaux et direct RTMP), pages web | TypeScript (Node 22) |
| `lunettes-mentra/` | Appli MentraOS « cloud » : direct vidéo des lunettes vers le cerveau | TypeScript (Bun) |
| `lunettes-meta/` | Appli Android pour Ray-Ban Meta / Ray-Ban Display : vidéo HEVC découpée en morceaux | Kotlin |

## 1. Lancer le cerveau

Il faut **Node 22.18 ou plus** et une **clé API Claude** ([console Anthropic](https://console.anthropic.com)). ffmpeg est installé automatiquement avec les dépendances.

```bash
cd cerveau
npm install
export ANTHROPIC_API_KEY=sk-ant-...     # obligatoire pour l'IA
export CLE_ACCES=un-mot-de-passe        # conseillé dès que le serveur est sur Internet
npm start                               # → http://localhost:8787
```

| Variable | Rôle | Par défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé de l'API Claude | — |
| `CLE_ACCES` | Si définie, l'API exige cette clé (en-tête `x-cle` ou `?cle=`) | aucune |
| `PORT` | Port HTTP | `8787` |
| `PORTS_RTMP` | Ports pour recevoir les directs vidéo (un par direct en cours) | `1935-1944` |
| `URL_RTMP_PUBLIQUE` | Adresse RTMP publique du serveur, si différente du nom d'hôte (ex. `rtmp://video.mon-serveur.fr`) | nom d'hôte de la requête |
| `DOSSIER_DONNEES` | Où sont rangées les leçons (vidéos, images, clips) | `./donnees` |
| `MODELE_IA` | Modèle Claude utilisé | `claude-opus-5-5` |

**Réseau :**
- Le téléphone (appli Meta) et la tablette doivent pouvoir joindre le cerveau en HTTP. En test, mets-les sur le même Wi-Fi.
- Pour Mentra, ce sont **les lunettes** qui envoient la vidéo en direct au cerveau : les ports `PORTS_RTMP` doivent être joignables depuis leur Wi-Fi. En local, c'est le cas sur le même réseau. Sinon, il faut ouvrir ces ports sur le serveur ou passer par un tunnel TCP.

## 2. Créer une leçon (le maître)

- **Depuis une vidéo.** Ouvre `http://<cerveau>/`, donne un titre et un métier, envoie la vidéo et ajoute si tu veux tes explications (quantités, pièges).
- **En filmant avec les lunettes.** Dans l'appli lunettes, choisis « Je suis le maître » et démarre, puis travaille en expliquant à voix haute. Dis « étape suivante » (ou appui court) à chaque étape, et « terminé » (ou appui long) à la fin. La vidéo complète est enregistrée, avec ta voix et tes repères d'étapes.

Dans les deux cas, l'IA découpe la démonstration en étapes en quelques minutes. Chaque étape reçoit :
- une consigne ;
- les points de contrôle, les erreurs fréquentes et les critères de réussite ;
- **un clip vidéo** en deux formats : tablette (720p, avec le son) et lunettes (266×150) ;
- **une séquence de référence** : 8 images du geste du maître, comparées à celles de l'apprenti.

## 3. Apprendre (l'apprenti)

- **Tablette seule (test sans lunettes).** Page d'accueil → « Apprendre » → « Utiliser la caméra de cet appareil ». La tablette filme en continu et envoie la vidéo par morceaux de 4 secondes.
- **Lunettes + tablette.** Lance la leçon sur les lunettes. Si la page « Apprendre » est ouverte sur une tablette, elle rejoint la session toute seule : clip du maître en boucle à côté, conseils en direct.
- **Commandes** (voix, bouton ou écran) : « vérifie » (ou « regarde », « c'est bon ? »), « explique », « suivant », « précédent », « répète », « recommence », « montre le geste », « pause ».

**Quand l'IA regarde.** Les lunettes filment tout le temps, mais le cerveau se contente de garder les 20 dernières secondes, sans appeler l'IA :
- **« vérifie »** (voix, bouton Mentra en appui court, bouton « Vérifier mon geste » sur l'écran des Ray-Ban Display ou la tablette) : l'IA regarde 8 images réparties sur la tentative. La durée regardée est 1,5 fois la durée de l'étape chez le maître, entre 4 et 20 secondes. L'apprenti entend « Je regarde », puis la réponse : une correction, un bravo (et l'étape suivante), ou « rien de faux, continue » ;
- **« suivant »** : l'IA vérifie d'abord la dernière tentative. Si elle voit une erreur, elle la dit et propose de redire « suivant » pour passer quand même ;
- **vérification automatique** (option de la leçon, désactivée par défaut) : le cerveau repère, sans IA, que l'apprenti a bougé puis s'est arrêté (fin probable d'un geste), et vérifie une fois. Les seuils de mouvement sont à régler sur le terrain ;
- **étapes à surveiller** (couteau, four…, cochées par le maître) : l'IA regarde en continu, toutes les 2 secondes, comme avant. L'apprenti est prévenu (« Je te surveille pendant cette étape »).

Le tuteur ne répète pas la même correction spontanée avant 15 secondes. En cas de doute, il ne corrige pas : une fausse correction fait plus de mal qu'un silence.

**Les étapes en texte.** Pour chaque étape, l'IA écrit une explication détaillée en plus de la consigne, avec les points clés, les erreurs à éviter, « c'est réussi quand », et ce que le maître a dit pendant l'étape (démonstration filmée avec les lunettes). Tout cela apparaît :
- sur la page de l'apprenti (« Comment faire ») avec le plan de la leçon ;
- dans la **fiche écrite** (`fiche.html?lecon=<id>`, bouton « Fiche écrite » de l'accueil), imprimable ;
- à l'oreille quand l'apprenti dit « explique ».

Le maître relit et corrige ce texte depuis la fiche (« Modifier le texte »). L'IA qui corrige l'apprenti s'appuie ensuite sur ce texte, et les séances en cours le reçoivent tout de suite.

L'apprenti donne son prénom (tablette, page de réglages Mentra, appli Meta) pour que le maître suive ses séances.

## 3 bis. Évaluer le pilote : le maître juge et corrige l'IA

Page d'accueil → « Évaluer les séances » (ou `http://<cerveau>/evaluation.html?lecon=<id>`).

- **Journal :** chaque analyse de l'IA est gardée, silences compris. Pour chacune, on garde les 8 images vues, le verdict, le message, s'il a été dit, l'étape, le délai de réponse et le coût.
- **Avis du maître :**
  - sur une correction : juste, fausse ou inutile ;
  - sur une validation d'étape : juste ou validée à tort ;
  - sur un silence : rien à dire ou erreur ratée.
- **Le maître corrige l'IA :** pour une correction fausse ou une erreur ratée, il explique pourquoi. Son explication peut devenir une **règle** (pour l'étape ou toute la leçon), que l'IA applique dès l'analyse suivante, y compris dans les séances en cours. Les règles se gèrent aussi à la main sur la même page.
- **Mesures du pilote :**
  - corrections justes, fausses et inutiles ;
  - erreurs ratées ;
  - séances terminées ;
  - temps médian pour réussir chaque étape seul ;
  - coût IA par heure de pratique, par séance et par analyse, et ce qui a déclenché les analyses (demande, « suivant », automatique, surveillance) ;
  - vérifications par étape ;
  - délai de réponse de l'IA.
- **Quand l'IA regarde :** vérification automatique oui ou non, étapes à surveiller en continu.
- **Cadence des étapes surveillées :** de 2 à 5 images par seconde. À 2 images par seconde, l'IA voit les 4 dernières secondes ; à 4, les 2 dernières, pour les gestes rapides. Le coût par analyse ne change pas.

Les séances sont rangées dans `donnees/seances/`. Les images des apprentis ne sont accessibles qu'avec la clé d'accès.

## 4. Installer l'appli Mentra

Mentra propose deux façons de faire une appli. On utilise l'appli **« cloud »** (SDK `@mentra/sdk`), parce que c'est celle qui permet aujourd'hui d'envoyer la vidéo des lunettes en direct. Les « mini-apps » locales ne le permettent pas encore.

1. Sur [console.mentra.glass](https://console.mentra.glass), crée une appli :
   - nom de paquet, par exemple `com.maitreapprenti.lunettes` ;
   - adresse publique = celle de ce service ;
   - autorisations **caméra** et **micro** ;
   - adresse de la page de réglages (webview) : `<adresse publique>/webview`.
2. Lance le service :
   ```bash
   cd lunettes-mentra
   bun install
   cp .env.example .env    # PACKAGE_NAME, MENTRAOS_API_KEY, URL_CERVEAU, CLE_CERVEAU
   bun start
   ```
   Pour les essais, expose-le avec un tunnel https (par exemple ngrok, comme dans la doc Mentra).
3. Dans l'appli Mentra du téléphone, ouvre « Maître & Apprenti », choisis ton mode et ta leçon dans la page de réglages, puis démarre avec un appui court sur le bouton des lunettes.

Mentra Live n'a pas d'écran : tout passe par la voix, et le clip du maître se regarde sur la tablette.

## 5. Installer l'appli Meta (Android)

1. Crée un compte sur le [Wearables Developer Center](https://wearables.developer.meta.com/), une organisation et une appli. Active la caméra, et si besoin l'écran (Ray-Ban Display) et la reconnaissance vocale.
2. Sur le téléphone, dans l'appli Meta AI, active le **mode développeur** pour les lunettes. En mode développeur, les identifiants peuvent rester à `0`. Sinon, crée `lunettes-meta/local.properties` :
   ```
   mwdat_application_id=...
   mwdat_client_token=...
   ```
3. Ouvre `lunettes-meta/` dans Android Studio, puis compile et installe sur le téléphone (Android 12 ou plus).
4. Dans l'appli : adresse du cerveau → « Enregistrer » → « Associer l'appli aux lunettes » (ouvre Meta AI) → « Connecter les lunettes » → « Démarrer ».

Les lunettes filment en HEVC à 15 images par seconde. Le téléphone découpe ce flux en morceaux qui commencent toujours par une image complète, et les envoie tels quels au cerveau, sans les décoder.
- **Apprenti :** le téléphone garde les 20 dernières secondes ; elles partent au cerveau avec « vérifie » ou « suivant ». Sur une étape surveillée (ou avec la vérification automatique), la vidéo part en continu par morceaux de 4 secondes.
- **Maître :** toute la vidéo, sans trou.

Sur les **Ray-Ban Display**, l'écran montre l'étape et la correction, avec les boutons « Vérifier mon geste », « Voir le geste », « Répéter » et « Étape suivante ».

## Tests

```bash
cd cerveau && npm test && npm run typecheck    # 49 tests
cd lunettes-mentra && bun test && bun run typecheck   # 10 tests, dont l'intégration avec le cerveau
cd lunettes-meta && ./gradlew test             # 19 tests (contrôleur + découpage vidéo HEVC)
```

## Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié, avec de vraies vidéos générées par ffmpeg et un **faux** serveur Claude (qui vérifie aussi la forme exacte des requêtes) :
- **Vidéo du maître → leçon** : étapes, clips aux deux formats, séquences de référence de 8 images.
- **Morceaux de vidéo de l'apprenti**, en MP4, WebM (tablette) et HEVC brut (Meta) : gardés sans appel à l'IA, puis 8 images comparées aux 8 du maître avec « vérifie » ou « suivant ».
- **Direct RTMP** : rien n'est analysé avant « vérifie » ; une étape surveillée est analysée en continu ; la démonstration du maître est enregistrée puis transformée en leçon.
- **Détection de fin de geste** sur de vraies images (image fixe puis mire animée), et la logique de déclenchement sur des images simulées.
- **Appli Mentra** : test d'intégration avec le vrai cerveau, où des « lunettes » simulées envoient une vraie vidéo en direct.
- **Appli Meta** : le découpage d'une vraie vidéo HEVC donne des morceaux que ffmpeg décode. Tout le code compile contre les vraies bibliothèques Meta (`mwdat` 1.0.0).
- **Tablette** : dans un vrai navigateur (Chromium, caméra simulée), aucun appel à l'IA pendant 9 secondes de caméra, puis un seul appel par clic sur « Vérifier mon geste » ou « Suivant ». Fiche écrite affichée, modifiée et relue.

Pas encore vérifié :
- **La qualité des corrections de l'IA** sur de vrais gestes. Il faut une clé API et un vrai essai avec un artisan.
- **Les vraies lunettes**, en particulier :
  - chez Meta, la caméra, l'écran et la voix sont des fonctions en préversion, et on ne sait pas si elles marchent ensemble ;
  - le format exact des images HEVC livrées par le SDK (le code accepte les deux formats courants) ;
  - la taille de vidéo acceptée par l'écran des Ray-Ban Display ;
  - la qualité du direct RTMP depuis le Wi-Fi des Mentra Live.
- **Le délai réel** entre « vérifie » et la réponse (visé : 3 à 5 secondes).
- **Les seuils de la vérification automatique** (quand considère-t-on que l'apprenti s'est arrêté ?) avec une vraie caméra portée sur la tête.
- **Le build Android complet (APK)** : il n'a pas pu être lancé dans l'environnement de développement (serveurs Google bloqués). Il faut compiler dans Android Studio.

## Coûts et vie privée

- **Créer une leçon** : environ 0,25 $, une seule fois. Ensuite, regarder les clips, la fiche et les étapes ne coûte rien, pour autant d'apprentis qu'on veut.
- **Chaque vérification = un appel à Claude avec 16 images** (8 du maître, mises en cache pendant l'étape, et 8 de l'apprenti), environ 2 centimes avec le modèle par défaut. À la demande, compte environ 1 à 1,5 $ par heure de pratique ; une étape surveillée en continu revient à 10 à 15 $ de l'heure. Les images sont réduites à 640 pixels de large. Le coût réel est calculé et affiché sur la page d'évaluation (par heure, par séance, par analyse).
- **Modèle moins cher** : `MODELE_IA=claude-sonnet-5-5` (environ deux fois moins cher) ou `MODELE_IA=claude-haiku-4-5` (environ quatre fois moins cher). Compare la justesse des corrections sur la page d'évaluation avant de changer.
- La vidéo part vers le serveur, puis les images extraites partent vers l'API Claude. Préviens les personnes filmées et évite de filmer des clients ou des documents.
- Les clips et images des leçons (`/media/...`) ne sont pas protégés par `CLE_ACCES`. Leurs adresses sont difficiles à deviner, mais ne sont pas secrètes. Les adresses de direct RTMP contiennent une clé aléatoire propre à chaque direct.
