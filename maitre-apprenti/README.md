# Maître & Apprenti

Le maître filme ses gestes une fois (une baguette, un croissant, une soudure…). L'apprenti les refait avec des lunettes connectées : il voit le geste du maître et une IA regarde son travail et le corrige à l'oreille, étape par étape.

Ça marche pour n'importe quel métier où il y a **un geste et un résultat visible**.

```
 MAÎTRE                                   APPRENTI
 vidéo (téléphone, lunettes)              lunettes (Mentra Live, Meta Ray-Ban Display)
 ou démonstration en direct               ou tablette avec caméra (test sans lunettes)
        │                                        │  photo toutes les 3-4 s
        ▼                                        ▼
 ┌─────────────────────────── CERVEAU (serveur) ──────────────────────────┐
 │ 1. découpe la démonstration en étapes (Claude) :                      │
 │    consigne, points de contrôle, erreurs fréquentes, critères,        │
 │    clip du maître par étape                                           │
 │ 2. pendant la leçon : compare la photo de l'apprenti au maître        │
 │    → « correction », « étape réussie », « rien à dire »,              │
 │      « je ne vois pas bien »                                          │
 └───────────────────────────────────────────────────────────────────────┘
        │  correction à dire / afficher, étape suivante, clip à montrer
        ▼
 lunettes (voix + écran s'il y en a un) et tablette (clip du maître en boucle)
```

## Contenu du dossier

| Dossier | Rôle | Langage |
|---|---|---|
| `cerveau/` | Serveur : leçons, IA, sessions, pages web (espace maître + tablette apprenti) | TypeScript (Node 22) |
| `lunettes-mentra/` | Appli pour les lunettes Mentra (Mentra Live, et autres lunettes compatibles MentraOS) | TypeScript (miniapp MentraOS) |
| `lunettes-meta/` | Appli Android pour les lunettes Meta (Ray-Ban Meta, Ray-Ban Display) | Kotlin |

## 1. Lancer le cerveau

Il faut **Node 22.18 ou plus** et une **clé API Claude** ([console Anthropic](https://console.anthropic.com)).

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
| `DOSSIER_DONNEES` | Où sont rangées les leçons (vidéos, images, clips) | `./donnees` |
| `MODELE_IA` | Modèle Claude utilisé | `claude-opus-5-5` |

Les lunettes passent par le téléphone : **le téléphone doit pouvoir joindre le cerveau**. En test, mets le téléphone sur le même Wi-Fi et utilise l'adresse locale de l'ordinateur (`http://192.168.x.x:8787`), ou un tunnel https (par exemple `cloudflared tunnel --url http://localhost:8787`).

## 2. Créer une leçon (le maître)

**Depuis une vidéo.** Ouvre `http://<cerveau>/`, donne un titre et un métier, envoie la vidéo et ajoute si tu veux les explications du maître (quantités, pièges). L'IA découpe la démonstration en étapes en quelques minutes. Chaque étape a :
- une consigne lue à l'apprenti ;
- des points de contrôle, les erreurs fréquentes et les critères de réussite ;
- un clip du maître en deux formats : tablette (720p, avec le son) et lunettes (266×150, sans le son).

**Directement avec les lunettes.** Dans l'appli lunettes, choisis « Je suis le maître », démarre, puis travaille en expliquant à voix haute. Dis « étape suivante » (ou appui court) à chaque étape et « terminé » (ou appui long) à la fin. Les lunettes envoient une photo toutes les 4 secondes et ta voix ; la leçon est construite avec des images de référence, sans clip vidéo.

Les leçons, leurs étapes et leurs clips sont visibles sur la page d'accueil (« Voir les étapes »).

## 3. Apprendre (l'apprenti)

- **Tablette seule (test sans lunettes).** Page d'accueil → « Apprendre » → « Utiliser la caméra de cet appareil ». Pose la tablette au-dessus du plan de travail.
- **Lunettes + tablette.** Lance la leçon sur les lunettes. Si la page « Apprendre » est ouverte sur une tablette, elle rejoint la session toute seule : clip du maître en boucle à côté, conseils en direct.
- **Commandes** (voix, bouton ou écran) : « suivant », « précédent », « répète », « recommence », « montre le geste », « pause ».

Le tuteur ne répète pas la même correction avant 15 secondes. Il passe à l'étape suivante quand il voit les critères de réussite. En cas de doute, il se tait : une fausse correction fait plus de mal qu'un silence.

## 4. Installer l'appli Mentra

Il faut [Bun](https://bun.sh) et l'appli Mentra sur le téléphone.

```bash
cd lunettes-mentra
bun install
bun run dev        # affiche un QR code
```

Dans l'appli Mentra : **Réglages → Réglages développeur → Mini App Development → Scan Mini App QR Code**. Le téléphone et l'ordinateur doivent être sur le même Wi-Fi (ou `bun run dev --usb`). Ensuite, ouvre l'appli « Maître & Apprenti » dans Mentra, renseigne l'adresse du cerveau, choisis une leçon, et démarre (bouton de l'écran ou appui court sur les lunettes).

- Mentra Live n'a pas d'écran : tout passe par la voix, et le clip du maître se regarde sur la tablette.
- Sur des lunettes MentraOS avec écran, l'étape et la correction s'affichent aussi.
- `bun run pack` produit le paquet d'installation (`build/*.zip`).

## 5. Installer l'appli Meta (Android)

1. Crée un compte sur le [Wearables Developer Center](https://wearables.developer.meta.com/), une organisation et une appli. Active la caméra, et si besoin l'écran (Ray-Ban Display) et la reconnaissance vocale.
2. Sur le téléphone, dans l'appli Meta AI, active le **mode développeur** pour les lunettes. En mode développeur, les identifiants peuvent rester à `0`. Sinon, crée `lunettes-meta/local.properties` :
   ```
   mwdat_application_id=...
   mwdat_client_token=...
   ```
3. Ouvre `lunettes-meta/` dans Android Studio, puis compile et installe sur le téléphone (Android 12 ou plus).
4. Dans l'appli : adresse du cerveau → « Enregistrer » → « Associer l'appli aux lunettes » (ouvre Meta AI) → « Connecter les lunettes » → « Démarrer ».

Sur les **Ray-Ban Display**, l'écran montre l'étape et la correction, avec les boutons « Voir le geste » (joue le clip du maître dans les lunettes), « Répéter » et « Étape suivante ». Sur les Ray-Ban Meta sans écran, tout passe par la voix.

## Tests

```bash
cd cerveau && npm test && npm run typecheck    # 21 tests, dont un parcours complet avec un faux serveur Claude
cd lunettes-mentra && bun test && bun run typecheck && bun run build
cd lunettes-meta && ./gradlew test             # tests du contrôleur (logique pure)
```

## Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié :
- **Cerveau** : 21 tests automatiques. Ils couvrent le découpage vidéo réel (ffmpeg), les clips aux deux formats, l'API, la sécurité des chemins et le parcours complet vidéo → leçon → correction. Ce parcours utilise un **faux** serveur Claude, qui vérifie la forme exacte des requêtes envoyées.
- **Mentra** : l'appli compile et se package avec les outils officiels Mentra. 8 tests du contrôleur (boucle photo, reprise après pause, mode maître, commandes vocales).
- **Meta** : tout le code Kotlin compile contre les vraies bibliothèques Meta (`mwdat` 1.0.0) et le framework Android. 10 tests du contrôleur passent. Le build Android complet (APK) n'a pas pu être lancé dans l'environnement de développement.

Pas encore vérifié :
- **La qualité des corrections de l'IA** sur de vrais gestes. Il faut une clé API et un vrai essai avec un artisan.
- **Les vraies lunettes.** Aucun test n'a été fait sur des Mentra Live ou des Ray-Ban. Points à surveiller : l'accès caméra + écran + voix en même temps chez Meta (fonctions expérimentales), et la taille de vidéo acceptée par les Ray-Ban Display.
- **Le délai réel** entre la photo et la correction (visé : 2 à 5 secondes).

## Coûts et vie privée

- **Chaque photo de l'apprenti = un appel à Claude**, soit environ 15 par minute avec une photo toutes les 4 secondes. Les images du maître sont mises en cache pendant l'étape pour réduire le coût. Mesure la consommation réelle pendant les premiers essais, et augmente l'intervalle si besoin (`INTERVALLE_PHOTO_MS` côté lunettes).
- Les photos partent vers le serveur, puis vers l'API Claude. Avec Mentra, elles transitent aussi par le stockage de Mentra (liens valables 24 h). Préviens les personnes filmées et évite de filmer des clients ou des documents.
- Les clips et images des leçons (`/media/...`) ne sont pas protégés par `CLE_ACCES`. Leurs adresses sont difficiles à deviner, mais ne sont pas secrètes.
