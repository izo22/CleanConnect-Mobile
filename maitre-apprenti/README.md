# Maître & Apprenti

Le maître filme ses gestes une fois (une baguette, un croissant, une soudure…). L'apprenti les refait avec des lunettes connectées qui **le filment en continu** : une IA compare ses gestes à ceux du maître et le corrige à l'oreille, étape par étape.

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
 │ 2. pendant la leçon : prend les 4 dernières secondes de vidéo de            │
 │    l'apprenti (8 images, 2 par seconde) et les compare au geste du maître   │
 │    → « correction », « étape réussie », « rien à dire », « je ne vois pas »  │
 └─────────────────────────────────────────────────────────────────────────────┘
        │  correction à dire / afficher, étape suivante, clip à montrer
        ▼
 lunettes (voix + écran s'il y en a un) et tablette (clip du maître en boucle)
```

**Pourquoi « 8 images » ?** L'IA (Claude) ne lit pas un fichier vidéo directement : elle regarde une vidéo comme une suite d'images rapprochées. Le cerveau découpe donc la vidéo en séquences de 4 secondes, à 2 images par seconde, pour que l'IA juge le **mouvement** (sens, ordre, rythme) et pas une photo isolée.

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
- **Commandes** (voix, bouton ou écran) : « suivant », « précédent », « répète », « recommence », « montre le geste », « pause ».

Le tuteur ne répète pas la même correction avant 15 secondes. Il passe à l'étape suivante quand il voit les critères de réussite. En cas de doute, il se tait : une fausse correction fait plus de mal qu'un silence.

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
  - coût IA par séance ;
  - délai de réponse de l'IA.
- **Cadence d'analyse :** de 2 à 5 images par seconde, leçon par leçon. À 2 images par seconde, l'IA voit les 4 dernières secondes ; à 4, les 2 dernières, pour les gestes rapides. Le coût par analyse ne change pas.

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
- **Apprenti :** les 4 dernières secondes.
- **Maître :** toute la vidéo, sans trou.

Sur les **Ray-Ban Display**, l'écran montre l'étape et la correction, avec les boutons « Voir le geste », « Répéter » et « Étape suivante ».

## Tests

```bash
cd cerveau && npm test && npm run typecheck    # 31 tests
cd lunettes-mentra && bun test && bun run typecheck   # 9 tests, dont l'intégration avec le cerveau
cd lunettes-meta && ./gradlew test             # 16 tests (contrôleur + découpage vidéo HEVC)
```

## Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié, avec de vraies vidéos générées par ffmpeg et un **faux** serveur Claude (qui vérifie aussi la forme exacte des requêtes) :
- **Vidéo du maître → leçon** : étapes, clips aux deux formats, séquences de référence de 8 images.
- **Morceaux de vidéo de l'apprenti**, en MP4, WebM (tablette) et HEVC brut (Meta) : 8 images comparées aux 8 du maître.
- **Direct RTMP** : l'apprenti est analysé en continu, et la démonstration du maître est enregistrée puis transformée en leçon.
- **Appli Mentra** : test d'intégration avec le vrai cerveau, où des « lunettes » simulées envoient une vraie vidéo en direct.
- **Appli Meta** : le découpage d'une vraie vidéo HEVC donne des morceaux que ffmpeg décode. Tout le code compile contre les vraies bibliothèques Meta (`mwdat` 1.0.0).
- **Tablette** : dans un vrai navigateur (Chromium, caméra simulée), les morceaux de 4 secondes partent et les corrections reviennent.

Pas encore vérifié :
- **La qualité des corrections de l'IA** sur de vrais gestes. Il faut une clé API et un vrai essai avec un artisan.
- **Les vraies lunettes**, en particulier :
  - chez Meta, la caméra, l'écran et la voix sont des fonctions en préversion, et on ne sait pas si elles marchent ensemble ;
  - le format exact des images HEVC livrées par le SDK (le code accepte les deux formats courants) ;
  - la taille de vidéo acceptée par l'écran des Ray-Ban Display ;
  - la qualité du direct RTMP depuis le Wi-Fi des Mentra Live.
- **Le délai réel** entre le geste et la correction (visé : 3 à 6 secondes, soit 4 s de vidéo plus le temps d'analyse).
- **Le build Android complet (APK)** : il n'a pas pu être lancé dans l'environnement de développement (serveurs Google bloqués). Il faut compiler dans Android Studio.

## Coûts et vie privée

- **Chaque séquence analysée = un appel à Claude avec 16 images** (8 du maître, mises en cache pendant l'étape, et 8 de l'apprenti), soit environ une analyse toutes les 2 à 5 secondes par apprenti. Les images sont réduites à 640 pixels de large pour limiter le coût. Le coût réel de chaque analyse est calculé et affiché sur la page d'évaluation.
- La vidéo part vers le serveur, puis les images extraites partent vers l'API Claude. Préviens les personnes filmées et évite de filmer des clients ou des documents.
- Les clips et images des leçons (`/media/...`) ne sont pas protégés par `CLE_ACCES`. Leurs adresses sont difficiles à deviner, mais ne sont pas secrètes. Les adresses de direct RTMP contiennent une clé aléatoire propre à chaque direct.
