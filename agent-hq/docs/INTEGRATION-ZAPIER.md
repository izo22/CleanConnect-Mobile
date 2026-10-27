# Brancher Zapier sur Orbyn

> English version for US clients: [en/connect-zapier.md](en/connect-zapier.md).

L'application **Orbyn pour Zapier** est une intégration **privée** : elle ne passe pas par la validation de Zapier et se partage par lien d'invitation avec vos clients pilotes.

## Ce qu'elle permet

| Niveau | Comment | Résultat |
|---|---|---|
| **Contrôler** (le plus important) | Étape **Orbyn · Ask Permission** juste avant l'action sensible, puis un 2e Zap qui part de **Orbyn · Decision Made** | L'action ne s'exécute **jamais** sans être autorisée. Sous vos seuils, elle passe tout de suite. Au-dessus, elle attend votre « Approuver » dans Orbyn. Si Orbyn est injoignable, l'étape échoue et rien ne part. |
| **Voir** | Étape **Orbyn · Report Activity** à la fin du Zap (et en cas d'échec) | Tâches, échecs, coût, alertes en langage courant, relecture IA si vous envoyez la question et la réponse. |
| **Arrêter** | Un petit Zap : **Orbyn · Agent Paused or Resumed** → **Zapier Manager · Turn Zap On/Off** | « Mettre en pause » dans Orbyn coupe le Zap concerné. Une pause est aussi refusée directement par « Ask Permission ». |

**Différence avec n8n :** Zapier ne laisse pas Orbyn lire vos Zaps de lui-même (il faut l'accès partenaire, plus tard). La supervision passe donc par l'étape « Report Activity » que vous ajoutez, et l'arrêt d'urgence par le petit Zap ci-dessus.

## Recette 1 : un remboursement qui attend votre feu vert

**Zap n° 1 : « Demander »**
1. Déclencheur : votre déclencheur habituel (nouveau ticket, formulaire…).
2. **Orbyn · Ask Permission** :
   - *Action* : `stripe.refund` (c'est ce nom que vos garde-fous comparent) ;
   - *Summary* : `Rembourser {{montant}} € à {{client}}` (la phrase que vous lirez) ;
   - *Amount* : `{{montant}}` ;
   - *Data to Keep for the Approved Action* : tout ce dont l'action aura besoin (n° de commande, e-mail du client, montant…).
3. L'action de remboursement (Stripe…).

→ **Sous le seuil**, l'étape 3 s'exécute tout de suite. **Au-dessus**, le Zap s'arrête proprement (statut *halted* dans Zapier) et la demande apparaît dans **Décisions**.

**Zap n° 2 : « Exécuter après accord »**
1. Déclencheur : **Orbyn · Decision Made**, avec *Only Approved Requests* = oui et *Only for This Action* = `stripe.refund`.
2. L'action de remboursement, avec les données de *Payload* (n° de commande, e-mail…).

→ Quand vous cliquez « Approuver » dans Orbyn, ce Zap part en quelques secondes. « Refuser » : rien ne se passe.

## Recette 2 : arrêt d'urgence

1. Déclencheur : **Orbyn · Agent Paused or Resumed**, *When the Agent Is* = *Paused*.
2. Action : **Zapier Manager · Turn Zap On/Off** → le Zap de l'agent, *Off*.

Faites un 2e Zap identique avec *Resumed* → *On* si vous voulez que « Reprendre » le rallume.

## Installer l'application (une fois)

Voir [zapier/README.md](../zapier/README.md) : `zapier login`, `zapier register "Orbyn"`, `zapier push`, puis `zapier users:links` pour obtenir le lien d'invitation à envoyer aux pilotes.

**Prérequis :** Orbyn doit être accessible sur Internet en **https** (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)). Les serveurs de Zapier l'appellent, et Orbyn ne prévient que des adresses https publiques.

## Ce qui a été vérifié, et ce qui ne l'a pas été

- ✅ **12 vérifications** avec le moteur de test officiel de Zapier (*appTester*) contre un vrai serveur Orbyn :
  - connexion, et refus d'une mauvaise clé ;
  - 45 € autorisés ;
  - 340 € qui arrêtent le Zap et créent une demande ;
  - approbation transmise avec les données gardées, refus qui ne déclenche rien ;
  - pause transmise, agent en pause refusé ;
  - Orbyn injoignable, donc rien n'est exécuté ;
  - remontée d'activité et alerte créée ;
  - désabonnement.
- ✅ Structure de l'application validée par l'outil officiel `zapier validate`.
- ❌ **Pas encore testée dans Zapier lui-même** : il faut un compte Zapier et Orbyn en ligne. Le premier pilote servira de test réel.
- ✅ Orbyn est en anglais et en dollars par défaut (`APP_LANGUAGE=fr` pour une instance en français et en euros).
