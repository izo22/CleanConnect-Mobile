# Agent HQ

**Gérer 100 agents IA sans devenir ingénieur en IA.**

Agent HQ est le poste de pilotage d'une équipe d'agents IA. On y voit chaque matin ce qui a besoin de vous, on règle un incident en un clic, on valide les décisions sensibles, et on fixe des garde-fous écrits en français. Tout ça fonctionne quelle que soit la plateforme utilisée pour construire les agents (n8n, Make, Zapier, Claude Agent SDK, OpenAI Agents, script maison).

## Démarrer

```bash
cd agent-hq
npm install
npm run build      # construit l'interface
npm start          # http://localhost:8787
```

Au premier lancement, une base de démonstration est créée : 100 agents, 8 jours d'historique et 4 vrais incidents détectés par le moteur (relances en double, réponses en anglais, coûts en hausse, accès HubSpot expiré).

Pour voir des agents travailler en direct, dans un second terminal :

```bash
npm run simulate
```

Les agents simulés passent par le vrai SDK. Ils s'arrêtent quand vous les mettez en pause et attendent votre feu vert pour les remboursements au-dessus du seuil.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | API + interface avec rechargement à chaud (interface sur http://localhost:5173) |
| `npm test` | tests du moteur, des garde-fous et de l'API |
| `npm run typecheck` | vérification TypeScript |
| `npm run seed` | remet la base de démonstration à zéro |

### Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `8787` | port HTTP |
| `DATABASE_PATH` | `data/agent-hq.db` | fichier SQLite |
| `ADMIN_TOKEN` | — | si défini, l'interface demande ce code d'accès |
| `NOTIFY_WEBHOOK_URL` | — | webhook Slack/Teams pour prévenir les responsables |
| `SEED_DEMO` | `true` | `false` pour démarrer avec une base vide |

Node.js 22.5 ou plus récent est requis (la base utilise `node:sqlite`, sans dépendance native).

## Ce que fait le produit

- **Brief du matin** : santé de la flotte, tâches, temps gagné, coût, incidents prioritaires et décisions en attente.
- **Mon équipe IA** : une fiche par agent (mission, responsable, budget, accès, niveau de confiance 0/1/2, consignes versionnées, journal, clé de connexion).
- **Alertes en français** : le moteur détecte les actions en double, les échecs répétés (accès expiré, limite de débit, panne), les réponses dans la mauvaise langue, les hausses de coût et les budgets presque épuisés. Chaque alerte dit *ce qui se passe, pourquoi et l'impact*, et se ferme seule quand le problème disparaît.
- **Actions en un clic** : mettre en pause, revenir à la version d'avant des consignes, confier à un humain, tout faire valider, passer au modèle économique, relever le budget, prévenir le responsable.
- **Décisions** : les agents demandent la permission avant une action qui dépasse leurs garde-fous, et attendent la réponse.
- **Garde-fous** : seuils de montant, heures de silence, plafond de dépense mensuel, pause automatique en cas de boucle.
- **Journal** : qui a fait quoi, humains et agents.

L'interface se met à jour en direct (Server-Sent Events).

## Connecter un agent

Chaque agent a une clé (visible dans sa fiche → « Connexion »). Trois appels suffisent :

```ts
import { AgentHQ } from "./sdk/agent-hq.ts";

const hq = new AgentHQ({ url: "https://votre-hq.exemple.fr", key: process.env.AGENT_HQ_KEY! });

// 1. Lire les consignes et l'état décidés par les humains (pause, niveau, modèle).
const { paused, prompt, model_tier } = await hq.config();

// 2. Demander la permission avant une action sensible (attend la décision si besoin).
await hq.guard(
  { action: "stripe.refund", amount_cents: 34000, summary: "Rembourser 340 € à Brasserie du Port" },
  () => stripe.refunds.create({ /* … */ }),
);

// 3. Rendre compte de son travail.
await hq.report({ kind: "task", action: "zendesk.reply", cost_cents: 3, language: "fr" });
```

Sans SDK, l'API HTTP suffit (n8n, Make et Zapier savent faire des requêtes HTTP) :

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/api/v1/events` | un événement ou `{ "events": [...] }` (500 max) |
| `POST` | `/api/v1/check` | `{ action, amount_cents?, summary?, sensitive? }` → `allow`, `deny` ou `needs_approval` |
| `GET` | `/api/v1/approvals/:id` | statut d'une demande (`pending`, `approved`, `rejected`) |
| `GET` | `/api/v1/config` | pause, niveau de confiance, modèle, consignes actives |

En-tête : `Authorization: Bearer <clé de l'agent>`.

## Architecture

```
agent-hq/
  server/        API Fastify + SQLite (node:sqlite)
    engine.ts    moteur d'alertes (détection, mise à jour, fermeture automatique)
    guard.ts     décisions allow / deny / needs_approval
    playbooks.ts actions en un clic
    translate.ts erreurs techniques → français
    queries.ts   modèles de lecture pour l'interface
  web/           interface React (Vite)
  sdk/           SDK sans dépendance pour les agents
  scripts/       simulateur
```

## Limites connues de ce MVP

- Un seul espace de travail, protégé par un code d'accès partagé (`ADMIN_TOKEN`), sans comptes utilisateurs.
- Les notifications partent vers un webhook unique ; pas encore d'e-mail ni de notification mobile.
- Pas encore de connecteurs natifs : les agents s'intègrent par le SDK ou l'API HTTP.
- Les garde-fous existants se règlent depuis l'interface ; en créer de nouveaux types demande du code.
