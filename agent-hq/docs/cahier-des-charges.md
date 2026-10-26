---
title: "Cahier des charges — Agent HQ"
subtitle: "Le poste de pilotage des agents IA pour les PME et ETI"
date: "Version 1.0 — 26 octobre 2026"
lang: fr
---

# 1. Objet du document

Ce document décrit le produit **Agent HQ** (nom provisoire ; pistes étudiées : *Régie*, *Mandat*, *Vigie*) : son objectif, ses utilisateurs, ses fonctionnalités, ses exigences techniques et les conditions de sa mise sur le marché.

Il sert de référence commune pour le développement, les choix d'hébergement, la facturation et la recette. Il distingue :

- **le socle déjà réalisé** (MVP fonctionnel, voir § 5) ;
- **la version de lancement (V1)**, qui ajoute la mise en ligne, les comptes utilisateurs et les espaces clients, les notifications et le paiement (§ 6 à 9) ;
- **les évolutions ultérieures** (§ 14).

Niveaux de priorité utilisés : **Indispensable** (bloquant pour le lancement), **Important** (attendu au lancement, contournable), **Souhaitable** (après lancement).

# 2. Contexte et problème

Les entreprises déploient de plus en plus d'**agents IA** : des programmes qui répondent aux clients, relancent les factures, qualifient les prospects, remboursent, planifient. Ils sont construits avec des outils variés (n8n, Make, Zapier, Claude Agent SDK, OpenAI Agents, scripts maison), souvent par une agence ou une personne débrouillarde, sans équipe IA dédiée.

Quand une entreprise passe de 3 à 50 ou 100 agents, le dirigeant perd la vue d'ensemble :

- il ne sait pas **ce que font** ses agents, **combien ils coûtent**, ni **ce qu'ils rapportent** ;
- il découvre les incidents **par ses clients** (e-mails en double, réponses en anglais, remboursements erronés) ;
- les outils existants affichent des **traces techniques** (tokens, latence, codes d'erreur) qu'il ne sait ni lire ni exploiter ;
- il n'a **aucun moyen simple d'agir** : mettre en pause, revenir en arrière, exiger une validation humaine.

**Question à laquelle répond le produit :** *comment permettre à un dirigeant de gérer 100 agents IA sans devenir ingénieur en intelligence artificielle ?*

# 3. Cible et utilisateurs

## 3.1 Clients visés

| Segment | Description | Priorité |
|---|---|---|
| PME et ETI de 20 à 500 salariés | 10 à 200 agents, construits sans équipe IA interne | Cœur de cible |
| Agences et intégrateurs d'automatisation | Construisent et maintiennent des agents pour plusieurs clients | Canal de distribution |
| Grands comptes | Exigences de sécurité et d'hébergement dédiées | Hors périmètre V1 |

## 3.2 Profils d'utilisateurs (personas)

- **Le dirigeant** : veut savoir en 2 minutes si tout va bien, ce qui demande son attention et combien ça coûte. Utilise surtout le brief du matin et le téléphone.
- **Le responsable opérationnel** (« ops », office manager, responsable service client) : responsable de plusieurs agents, traite les alertes, valide les décisions, ajuste les règles.
- **Le constructeur d'agents** (interne ou agence) : connecte les agents au produit avec la clé API ou le SDK, modifie les consignes.
- **Un membre de l'équipe** : constate une erreur d'un agent et la signale.

# 4. Proposition de valeur et positionnement

## 4.1 Promesse

*« Le manager de vos agents IA : vous fixez les règles, ils demandent la permission, vous gardez le contrôle, quel que soit l'outil avec lequel ils ont été construits. »*

## 4.2 Paysage concurrentiel

| Catégorie | Exemples | S'adresse à | Limite pour notre cible |
|---|---|---|---|
| Observabilité des LLM | LangSmith, Langfuse, Arize, Helicone, Datadog LLM | Ingénieurs | Constate après coup, en langage technique |
| Plateformes de grands éditeurs | Microsoft, Salesforce Agentforce, ServiceNow, Workday | DSI de grands groupes | Centrées sur leur écosystème, longues à déployer |
| Outils de construction | n8n, Make, Zapier | Constructeurs | Vue limitée à leurs propres workflows |

## 4.3 Éléments différenciants

1. **Être dans le circuit de décision** : les agents demandent la permission *avant* d'agir (vérification préalable), au lieu d'être seulement observés après coup.
2. **Neutralité** : un seul tableau de bord pour des agents construits avec des outils différents.
3. **Langage métier** : fiche de poste, responsable, niveau de confiance ; chaque alerte explique *ce qui se passe, pourquoi, l'impact* et propose des actions.
4. **Preuve de supervision humaine** utile à la conformité européenne (journal, validations humaines, relecture), en lien avec le règlement européen sur l'IA. Les obligations exactes applicables à chaque client restent à valider avec un conseil juridique.

# 5. Socle réalisé (MVP)

Le MVP est fonctionnel, testé et versionné dans le dossier `agent-hq/`. Il constitue la base de la V1.

| Module | Contenu |
|---|---|
| Brief du matin | Santé de la flotte, tâches, temps gagné, coût, 3 incidents prioritaires, décisions en attente |
| Mon équipe IA | Fiche par agent : mission, responsable, budget, accès, niveau de confiance 0/1/2, consignes versionnées, qualité, journal, clé de connexion |
| Alertes | Détection automatique et explication en français, fermeture automatique quand le problème disparaît |
| Actions en un clic | Pause, retour aux consignes précédentes, confier à un humain, tout faire valider, modèle économique, budget, prévenir le responsable |
| Décisions | File d'attente des actions qui dépassent les garde-fous ; l'agent attend la réponse |
| Qualité | Relecture d'un échantillon de réponses par une IA ; l'humain confirme ou écarte |
| Signalement | Tout membre de l'équipe peut signaler une erreur d'un agent |
| Garde-fous | Seuils de montant, heures de silence, plafond mensuel, pause automatique en cas de boucle |
| Journal | Traçabilité de toutes les actions, humaines et automatiques |
| Intégration | API HTTP et SDK sans dépendance ; simulateur de démonstration |

### 5.1 Détection des problèmes

| Type d'alerte | Signal utilisé | Gravité |
|---|---|---|
| Actions en double | Même action, même destinataire, répétée dans l'heure | Urgent |
| Accès expiré | Majorité d'échecs avec erreurs d'authentification | Bloqué |
| Limite du fournisseur | Majorité d'échecs « trop de requêtes » | Bloqué |
| Échecs répétés | Plus de 50 % d'échecs sur 30 minutes | À surveiller |
| Mauvaise langue | Plus de 30 % des réponses dans une autre langue que celle attendue | À surveiller |
| Hausse de coût | Coût des 24 h supérieur à 2 fois la moyenne des 7 jours précédents | À surveiller |
| Budget | 90 % du budget mensuel consommé (100 % : urgent) | À surveiller / Urgent |
| Qualité | Plus de 15 % d'erreurs dans les réponses relues sur 24 h | À surveiller / Urgent |
| Signalement humain | Au moins un signalement ouvert | À surveiller / Urgent |

### 5.2 Limites connues du MVP

- Un seul espace de travail, protégé par un code partagé, sans comptes individuels → **traité par la V1 (§ 7)**.
- Notifications par webhook uniquement → **traité par la V1 (§ 8)**.
- Pas de facturation → **traité par la V1 (§ 9)**.
- Fonctionne en local → **traité par la V1 (§ 6)**.
- La relecture IA juge par rapport aux consignes et aux échanges transmis, pas par rapport aux données réelles de l'entreprise.

# 6. V1 — Mise en ligne et hébergement

| ID | Exigence | Priorité |
|---|---|---|
| H-01 | L'application est livrée sous forme d'**image Docker** unique (serveur, interface, moteur d'alertes, relecture) | Indispensable |
| H-02 | Hébergement **dans l'Union européenne** (ex. Scaleway, OVHcloud, Clever Cloud) | Indispensable |
| H-03 | **HTTPS** obligatoire, certificat automatique | Indispensable |
| H-04 | Base de données sur **volume persistant**, sauvegarde quotidienne conservée 30 jours | Indispensable |
| H-05 | Point de contrôle de santé (`/api/health`) pour l'hébergeur | Indispensable |
| H-06 | Configuration exclusivement par **variables d'environnement** ; aucun secret dans le code | Indispensable |
| H-07 | Guide de déploiement pas à pas, compréhensible par un non-spécialiste | Important |
| H-08 | Journaux d'exécution consultables chez l'hébergeur | Important |

**Disponibilité visée :** 99,5 % mensuelle. **Volume visé au lancement :** 50 clients, 5 000 agents, 5 millions d'événements par mois sur une seule instance.

# 7. V1 — Comptes utilisateurs et espaces clients

## 7.1 Principes

- Chaque client dispose d'un **espace** (organisation) isolé : agents, alertes, règles, décisions, journal et facturation sont propres à l'espace.
- Une personne a **un compte** (e-mail + mot de passe) et peut appartenir à plusieurs espaces (cas des agences).
- Les agents s'authentifient avec leur **clé d'agent**, qui détermine leur espace.

## 7.2 Exigences

| ID | Exigence | Priorité |
|---|---|---|
| C-01 | Inscription : prénom, e-mail, mot de passe, nom de l'entreprise ; crée l'espace et en fait le propriétaire | Indispensable |
| C-02 | Connexion / déconnexion ; session par cookie sécurisé (HttpOnly, Secure, SameSite) | Indispensable |
| C-03 | Mots de passe hachés avec un algorithme lent (scrypt ou argon2), 10 caractères minimum | Indispensable |
| C-04 | **Isolation stricte** : aucune donnée d'un espace n'est visible depuis un autre ; testé automatiquement | Indispensable |
| C-05 | Rôles : **Propriétaire** (tout, dont facturation), **Administrateur** (tout sauf facturation), **Membre** (consulte, valide les décisions, signale, traite les alertes ; ne modifie ni règles ni agents) | Indispensable |
| C-06 | Invitation d'un collègue par e-mail avec un rôle ; lien valable 7 jours | Indispensable |
| C-07 | Changer d'espace depuis l'interface (agences) | Important |
| C-08 | Mot de passe oublié : lien de réinitialisation par e-mail valable 1 heure | Important |
| C-09 | Limitation des tentatives de connexion (anti force brute) | Important |
| C-10 | Le journal indique la personne réelle derrière chaque action | Indispensable |
| C-11 | Espace de démonstration pré-rempli à la demande, pour essayer sans connecter d'agent | Souhaitable |
| C-12 | Connexion via Google / Microsoft | Souhaitable |

# 8. V1 — Notifications

## 8.1 Événements notifiés

| Événement | Par défaut |
|---|---|
| Nouvelle alerte **Urgente** ou **Bloquée** | Push + e-mail |
| Nouvelle alerte **À surveiller** | Dans l'application uniquement |
| Nouvelle décision à valider | Push |
| Erreur signalée sur un agent dont on est responsable | Push + e-mail |
| Résumé quotidien (brief du matin) | E-mail, 8 h heure de Paris |

## 8.2 Exigences

| ID | Exigence | Priorité |
|---|---|---|
| N-01 | **Notifications push** sur téléphone et ordinateur via l'application web installable (Web Push, sans application native) | Indispensable |
| N-02 | **E-mails** transactionnels (alertes, invitations, réinitialisation) via un prestataire européen ou un serveur SMTP | Indispensable |
| N-03 | Préférences par utilisateur : choisir les canaux par type d'événement | Important |
| N-04 | Un clic sur une notification ouvre directement l'alerte ou la décision concernée | Important |
| N-05 | Pas plus d'une notification par alerte (pas de rafale quand une alerte est mise à jour) | Indispensable |
| N-06 | Webhook Slack / Teams conservé pour l'espace | Important |
| N-07 | Validation d'une décision directement depuis la notification | Souhaitable |

# 9. V1 — Abonnement et paiement

## 9.1 Offres proposées (à valider commercialement)

| Offre | Prix indicatif | Agents inclus | Relecture IA | Utilisateurs |
|---|---|---|---|---|
| Essai | Gratuit 14 jours | 10 | Incluse | Illimités |
| Équipe | 49 € HT / mois | 10 | 10 % des réponses | Illimités |
| Pro | 199 € HT / mois | 50 | 10 % des réponses | Illimités |
| Entreprise | Sur devis | Plus de 50 | Personnalisée | Illimités |

## 9.2 Exigences

| ID | Exigence | Priorité |
|---|---|---|
| P-01 | Paiement par carte et prélèvement SEPA via **Stripe** (page de paiement hébergée par Stripe) | Indispensable |
| P-02 | Essai gratuit de 14 jours sans carte bancaire | Important |
| P-03 | Le **nombre d'agents** est limité selon l'offre ; au-delà, l'ajout est bloqué avec une invitation à changer d'offre | Indispensable |
| P-04 | Statut d'abonnement mis à jour par les **webhooks Stripe** (signature vérifiée) | Indispensable |
| P-05 | Le propriétaire gère son abonnement, sa carte et ses factures dans le **portail client Stripe** | Indispensable |
| P-06 | En cas d'impayé : bandeau d'avertissement 7 jours, puis lecture seule ; les agents ne sont **jamais** coupés brutalement (les vérifications avant action continuent de répondre) | Indispensable |
| P-07 | Factures conformes (TVA, mentions légales) émises par Stripe | Indispensable |
| P-08 | Seul le rôle Propriétaire accède à la facturation | Indispensable |

# 10. Intégration des agents

| ID | Exigence | Priorité |
|---|---|---|
| I-01 | API HTTP documentée : envoi d'événements, vérification avant action, statut d'une demande, configuration | Indispensable (réalisé) |
| I-02 | SDK JavaScript / TypeScript sans dépendance | Indispensable (réalisé) |
| I-03 | Clé par agent, renouvelable, révocable | Indispensable (réalisé) |
| I-04 | Guides de connexion pour n8n, Make et Zapier (requête HTTP) | Important |
| I-05 | SDK Python | Important |
| I-06 | Connecteurs natifs (nœud n8n, module Make) | Souhaitable |

# 11. Exigences non fonctionnelles

## 11.1 Sécurité

- Isolation des espaces vérifiée par tests automatiques (C-04).
- Clés d'agent aléatoires (au moins 128 bits), jamais affichées dans les journaux.
- Toutes les entrées validées côté serveur ; limites de taille sur les événements.
- Les contenus transmis par les agents sont traités comme des **données non fiables** (protection contre l'injection d'instructions dans la relecture IA).
- En-têtes de sécurité HTTP, cookies sécurisés, HTTPS obligatoire.

## 11.2 Données personnelles (RGPD)

- Hébergement et traitement dans l'UE ; sous-traitants listés (hébergeur, Stripe, prestataire e-mail, fournisseur du modèle de relecture IA).
- Contrat de sous-traitance (DPA) proposé aux clients.
- Durées de conservation : événements 90 jours, journal et décisions 1 an, données de compte jusqu'à la fermeture de l'espace + 30 jours.
- Export et suppression des données d'un espace sur demande.
- Les champs `input` / `output` (contenu des échanges) sont facultatifs ; la relecture IA peut être désactivée par agent.

## 11.3 Performance

- Ingestion : 200 événements par seconde sur une instance.
- Affichage du brief du matin en moins d'une seconde pour 200 agents.
- Mise à jour en direct de l'interface en moins de 2 secondes après un événement.

## 11.4 Accessibilité et ergonomie

- Interface entièrement en français, sans jargon technique.
- Utilisable au clavier, contrastes conformes WCAG 2.1 niveau AA.
- Utilisable sur téléphone (largeur 360 px), installable comme application.

# 12. Architecture technique

| Composant | Choix |
|---|---|
| Serveur | Node.js 22, Fastify, TypeScript |
| Base de données | SQLite (fichier sur volume persistant) au lancement ; migration vers PostgreSQL prévue au-delà de 50 clients |
| Interface | React + Vite, application web installable (PWA) |
| Temps réel | Server-Sent Events |
| Relecture IA | API Claude (Anthropic), réponse au format JSON contraint |
| E-mails | SMTP (prestataire européen) |
| Push | Web Push (VAPID) |
| Paiement | Stripe Checkout, portail client, webhooks |
| Déploiement | Image Docker, hébergeur européen |

# 13. Recette et critères d'acceptation

La V1 est acceptée lorsque :

1. Un nouveau client peut **s'inscrire, créer son espace, inviter un collègue**, connecter un agent avec sa clé et voir ses premiers événements, sans aide.
2. Deux espaces de test ne voient **aucune** donnée l'un de l'autre (tests automatiques et vérification manuelle).
3. Une alerte urgente déclenche **une** notification push et **un** e-mail au responsable en moins d'une minute.
4. Un paiement de test Stripe active l'offre ; dépasser la limite d'agents est bloqué ; un impayé simulé produit le bandeau puis la lecture seule, sans couper les agents.
5. L'application tourne chez un hébergeur européen en HTTPS, survit à un redémarrage sans perte de données, et une sauvegarde peut être restaurée.
6. Tous les tests automatiques passent ; aucune erreur dans la console du navigateur sur les parcours principaux.

# 14. Évolutions après lancement

- Connecteurs natifs n8n, Make, Zapier ; SDK Python.
- Contrôle direct dans les outils (vérifier dans Gmail ou Stripe ce qui a réellement été fait).
- Signaux métier : ticket rouvert, remboursement contesté, devis refusé.
- Règles écrites en une phrase et traduites automatiquement en garde-fous.
- Rapports de conformité exportables (preuve de supervision humaine).
- Application mobile native si les clients la demandent.
- Offre agences : facturation de plusieurs espaces clients sur un seul compte.

# 15. Risques

| Risque | Impact | Réponse |
|---|---|---|
| Les grands éditeurs proposent une « vue dirigeant » | Élevé | Neutralité multi-outils, vitesse, canal agences |
| Les agents ne transmettent pas assez d'informations | Élevé | SDK simple, guides n8n / Make, valeur visible dès les premiers événements |
| Fausses alertes de la relecture IA | Moyen | L'humain tranche ; les fausses alertes sont exclues des statistiques |
| Coût de la relecture IA | Moyen | Échantillonnage réglable par agent ; quota par offre |
| Fuite de données entre clients | Critique | Isolation testée automatiquement, revue de sécurité avant lancement |
| Nom et marque indisponibles | Moyen | Vérification INPI / EUIPO et noms de domaine avant tout dépôt |

# 16. Glossaire

- **Agent IA** : programme qui accomplit des tâches de façon autonome à l'aide d'un modèle d'IA.
- **Espace** : l'environnement isolé d'un client dans le produit.
- **Événement** : message envoyé par un agent pour rendre compte d'une tâche ou d'une action.
- **Vérification avant action** : question posée par l'agent au produit avant une action sensible ; réponse : autorisé, refusé ou en attente de validation humaine.
- **Niveau de confiance** : 0 (tout est validé), 1 (actions sensibles validées), 2 (autonome dans les limites des garde-fous).
- **Garde-fou** : règle qui s'applique à tous les agents d'un espace.
- **Relecture IA** : contrôle d'un échantillon de réponses par une IA, au regard des consignes de l'agent.
