# Brancher Zapier sur Orvanta

> English version for US clients: [en/connect-zapier.md](en/connect-zapier.md).

Avec la version **1.2.0** de l'application Orvanta pour Zapier, une seule clé suffit pour tous les Zaps d'un espace, et chaque Zap devient un agent dans Orvanta, comme les workflows n8n. Tout se règle depuis **Connexions → Zapier**, qui guide pas à pas.

## Ce que ça fait

| Fonction | Comment |
|---|---|
| **Voir les erreurs** de tous les Zaps | Un Zap à installer une fois : *Zapier Manager → New Zap Error* → *Orvanta → Report a Zap Error*. Chaque Zap qui plante crée ou met à jour son agent, avec l'alerte. |
| **Voir les réussites** | Étape *Orvanta → Report Activity* en fin de Zap (c'est la seule chose que Zapier ne signale jamais tout seul). |
| **Demander la permission** | Étape *Orvanta → Ask Permission* juste avant l'action sensible. Le Zap **attend** votre clic dans Décisions (jusqu'à 30 jours), puis continue tout seul ; refusé, il s'arrête. Seuils de montant, heures interdites, « Je valide tout » et vérification IA s'appliquent. |
| **Arrêt d'urgence** | Un Zap à installer une fois : *Orvanta → Agent Paused or Resumed* (Agent vide = tous) → *Zapier Manager*, action qui éteint un Zap. Même sans lui, les étapes Ask Permission d'un agent en pause sont refusées. |

**Pourquoi des étapes à ajouter, alors que n8n se branche tout seul ?** Zapier ne laisse aucun outil extérieur lire ou modifier les Zaps d'un client. Orvanta ne voit que ce que les Zaps lui envoient. Les Zaps modèles (liens « copier ce Zap ») évitent au patron de les monter lui-même.

## La clé Zapier et le champ « Agent »

- **Connexions → Zapier → Créer ma clé Zapier** (propriétaire de l'espace). La clé commence par `ozk_`.
- Dans Zapier, la première étape Orvanta demande l'**adresse Orvanta** et cette **clé**. Une seule connexion pour tous les Zaps.
- Chaque étape Orvanta a un champ **Agent** : choisissez un agent existant, ou tapez un nom (conseil : celui du Zap) et Orvanta crée l'agent la première fois.
- La clé d'un agent (`ahq_…`) marche toujours : le champ Agent n'apparaît alors pas.
- **Créer une nouvelle clé** invalide l'ancienne : à faire seulement si elle a fuité.

## Recette : un devis qui attend votre feu vert

```
1. Gmail : nouvel e-mail de demande de devis
2. ChatGPT : rédige le devis
3. Orvanta : Ask Permission      ← Agent : « Devis panneaux solaires »
                                    Summary : « Devis pour {client} : {montant} € »
                                    Amount : {montant}
                                    Text Received / Text About to Be Sent : pour la vérification IA
                                    When Your Approval Is Needed : Wait for the decision, then go on
4. Gmail : envoie le devis       ← ne s'exécute qu'une fois autorisé
5. Orvanta : Report Activity     ← facultatif, pour compter les réussites
```

- Sous vos seuils : Orvanta répond « autorisé » tout de suite, le Zap continue.
- Au-dessus, ou avec « Je valide tout » : la demande attend dans **Décisions**. **Approuver** : le Zap reprend à l'étape 4. **Refuser** : il s'arrête.
- Orvanta injoignable : l'étape échoue, donc l'e-mail ne part pas.

L'ancien mode (« Stop this Zap » + un second Zap qui démarre sur *Decision Made*) reste disponible, et les étapes créées avant la 1.2.0 le gardent, pour ne jamais faire une action deux fois.

## Ce que fait l'administrateur d'Orvanta (une fois pour tous les clients)

1. Publier la version 1.2.0 de l'application : voir [zapier/README.md](../zapier/README.md).
2. Créer dans son propre Zapier les Zaps modèles « Surveiller tous mes Zaps » et « Arrêt d'urgence » (et, si voulu, un exemple avec Ask Permission), puis copier leur lien de partage (*Zap → ⋯ → Share*).
3. Les coller avec le lien d'invitation dans **Administration → Liens Zapier**. Ils apparaissent alors dans Connexions → Zapier de chaque espace ; sans lien, les clients voient comment faire à la main.

**Prérequis :** Orvanta accessible sur Internet en **https** (les serveurs de Zapier l'appellent, et Orvanta ne rappelle que des adresses https publiques).

## Ce qui a été vérifié, et ce qui ne l'a pas été

- ✅ **16 vérifications** avec le moteur de test officiel de Zapier (*appTester*) contre un vrai serveur Orvanta, dont : clé d'espace, liste des agents, agent créé à partir d'un nouveau nom, Ask Permission qui attend puis reprend (approuvé) ou s'arrête (refusé), erreur de Zap remontée, pause d'un agent transmise à l'abonnement de tout l'espace.
- ✅ 7 tests côté Orvanta : clé, agents par nom, rappel de Zapier même si la décision arrive avant, refus des adresses privées et des demandes d'un autre espace, liens administrateur.
- ✅ Structure validée par l'outil officiel de Zapier.
- ❌ **Pas encore testé dans Zapier lui-même.** À vérifier sur un vrai compte : l'attente d'Ask Permission (« callback »), les noms exacts des déclencheurs et actions de *Zapier Manager*, et s'ils demandent une formule payante.
