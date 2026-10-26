# Brancher n8n sur Agent HQ

Ce guide s'adresse à la personne qui construit et maintient les workflows n8n (agence ou équipe interne). Comptez 5 minutes pour les niveaux 1 et 2, puis 2 minutes par workflow sensible pour le niveau 3.

## Ce qu'Agent HQ peut faire, et ce qu'il ne peut pas faire

| Niveau | Ce qu'il faut faire | Ce que vous obtenez | Limite |
|---|---|---|---|
| **1. Voir** | Donner une clé API n8n à Agent HQ | Chaque workflow devient un agent. Ses réussites, ses échecs et le message d'erreur remontent toutes les 30 secondes. Les incidents sont expliqués en français. | n8n ne transmet pas le coût des appels d'IA. |
| **2. Arrêter** | Rien de plus | « Mettre en pause » **désactive vraiment le workflow** dans n8n (mesuré : moins de 0,3 s). « Reprendre » le réactive. Si quelqu'un le réactive dans n8n alors qu'il est en pause dans Agent HQ, Agent HQ le coupe à nouveau. | Une exécution **déjà en cours** au moment de la pause va jusqu'au bout. |
| **3. Contrôler** | Coller le bloc « Demander l'autorisation » avant l'étape sensible | Le workflow **s'arrête et attend** votre feu vert dans Agent HQ avant de rembourser, payer ou envoyer. Approuvé : il continue. Refusé : il s'arrête. | Seules les étapes protégées par le bloc sont contrôlées. |

Dans Agent HQ, chaque agent affiche le niveau dont il bénéficie réellement : *Supervision + arrêt d'urgence* ou *Contrôle avant action*.

## Niveaux 1 et 2 : connecter n8n

1. Dans n8n : **Settings → n8n API → Create an API key**.
2. Donnez-lui **uniquement** ces droits :
   `workflow:list`, `workflow:read`, `workflow:activate`, `workflow:deactivate`, `execution:list`, `execution:read`.
   Agent HQ n'a besoin ni de créer, ni de modifier, ni de supprimer vos workflows.
3. Dans Agent HQ : **Connexions → Connecter un serveur n8n**, collez l'adresse de n8n et la clé, puis **Tester et connecter**.

Les workflows apparaissent dans **Mon équipe IA**. Renseignez le responsable et le budget de chacun dans sa fiche.

## Niveau 3 : faire attendre le feu vert

1. Dans Agent HQ, ouvrez la fiche de l'agent (le workflow), puis cliquez sur **Copier le bloc « Demander l'autorisation » pour n8n**.
2. Dans n8n, ouvrez le workflow et collez le bloc (Ctrl+V ou Cmd+V). Il contient 7 nœuds :

```
Demander l'autorisation → Autorisé ? ──oui──────────────────────────────────→ [votre étape sensible]
                              └─non→ Validation demandée ? ─oui→ Attendre le feu vert → Feu vert ? ─oui→ [votre étape sensible]
                                          └─non → Refusé                                    └─non → Refusé
```

3. Branchez le bloc juste **avant** l'étape sensible. Remplacez le nœud « Votre action sensible (à remplacer) » par votre étape, reliée aux **deux** sorties « oui ».
4. Dans **Demander l'autorisation**, adaptez le corps JSON :
   - `action` : par exemple `stripe.refund`, `email.send`, `quote.send`. C'est ce nom que vos garde-fous comparent (« remboursement au-dessus de 200 € », « pas d'e-mail entre 22 h et 7 h »).
   - `amount_cents` : le montant en centimes, par exemple `Math.round($json.body.amount * 100)`.
   - `summary` : la phrase que vous lirez dans Agent HQ, par exemple `'Rembourser ' + $json.body.amount + ' € à ' + $json.body.customer`.
   - Ne touchez pas à `callback_url: $execution.resumeUrl` : c'est l'adresse qu'Agent HQ appelle pour réveiller le workflow.
5. Dans votre étape sensible, reprenez les données d'origine avec `$('Nom de votre déclencheur').item.json`. Après le bloc, `$json` contient la réponse d'Agent HQ, pas vos données.
6. Enregistrez et activez le workflow.

### Ce qui se passe ensuite

- **Sous vos seuils** (par exemple un remboursement de 45 €) : Agent HQ répond « autorisé » tout de suite, le workflow continue sans attendre.
- **Au-dessus de vos seuils**, ou pour un agent au niveau de confiance 0 : la demande apparaît dans **Décisions** avec la mention « le workflow est en attente ». L'exécution n8n est en pause : elle ne consomme rien.
- **Approuver** : Agent HQ réveille l'exécution, qui passe par « Feu vert ? → oui » et exécute votre étape.
- **Refuser** : l'exécution se réveille et se termine sur « Refusé ».
- **Personne ne répond sous 24 h** : l'exécution se réveille seule et se termine sur « Refusé ». Vous pouvez changer ce délai dans « Attendre le feu vert ».
- **L'agent est en pause dans Agent HQ** : la demande est refusée immédiatement.
- **Agent HQ est injoignable** (panne, réseau) : le nœud « Demander l'autorisation » échoue et **le workflow s'arrête sans exécuter l'étape sensible**. C'est volontaire : en cas de doute, on ne paie pas. Si vous préférez continuer quand Agent HQ est injoignable, activez *Settings → On Error → Continue* sur ce nœud, en connaissance de cause.

### Sécurité

- La clé de l'agent est visible dans le nœud HTTP. Pour la masquer, créez une credential n8n de type *Header Auth* (`Authorization: Bearer <clé>`) et utilisez-la dans le nœud.
- Agent HQ n'accepte de rappeler que le serveur n8n connecté : une `callback_url` qui pointe ailleurs est refusée.

## Ce qui a été vérifié

Le script `npm run verify:n8n` rejoue tout le parcours contre un **vrai n8n** (version 2.44 lors du dernier passage). Il crée trois workflows de test, connecte Agent HQ, puis vérifie 16 points, dont :

- les échecs d'un workflow deviennent une alerte en français ;
- la pause coupe réellement le workflow, et la reprise le relance ;
- une réactivation sauvage dans n8n est annulée par Agent HQ ;
- un remboursement de 340 € attend l'accord et n'est payé qu'après « Approuver » ;
- un remboursement refusé n'est jamais payé ;
- un remboursement de 45 € passe sans attente ;
- si Agent HQ est injoignable, rien n'est payé.

```bash
AGENT_HQ_URL=http://localhost:8787 N8N_URL=http://localhost:5678 \
N8N_HQ_KEY=<clé aux droits limités> N8N_SETUP_KEY=<clé pouvant créer des workflows> \
npm run verify:n8n
```

Le script utilise un faux service de paiement sur le port 9999 pour savoir quels remboursements sont réellement partis.
