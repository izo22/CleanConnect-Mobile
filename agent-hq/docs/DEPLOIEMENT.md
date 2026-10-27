# Mettre Agent HQ en ligne

Ce guide met Agent HQ sur Internet, en **https**, avec sauvegardes automatiques. Comptez environ 30 minutes la première fois. On copie-colle des commandes, il n'y a pas de code à écrire.

## Ce qu'il vous faut

| Quoi | Exemple | Coût indicatif |
|---|---|---|
| Un serveur Linux (VPS), 2 Go de mémoire, Ubuntu 24.04 | Hetzner, DigitalOcean, OVHcloud, Scaleway | 5 à 10 $ par mois |
| Un nom de domaine (ou un sous-domaine d'un domaine que vous avez déjà) | `hq.votre-agence.com` | 10 à 15 $ par an |
| Une clé Claude, si vous voulez la relecture par IA | console.anthropic.com | environ 0,4 centime par réponse relue |

**Où louer le serveur :** si vos clients sont **aux États-Unis**, prenez un serveur aux États-Unis (Virginie, Oregon, New York…). Pour des clients **européens**, prenez l'Europe : les données restent dans l'UE (RGPD).

**Un serveur par client pilote.** Agent HQ n'a pas encore de comptes séparés par client : tout le monde partage un même espace et un même code d'accès. En attendant, donnez à chaque agence pilote **son propre serveur et son propre sous-domaine** (`agence1.votre-hq.com`, `agence2.votre-hq.com`…). Leurs données restent ainsi totalement séparées.

## 1. Créer le serveur

Chez l'hébergeur, créez un serveur **Ubuntu 24.04** avec 2 Go de mémoire, dans la bonne région. Notez son **adresse IP** (par exemple `203.0.113.10`).

## 2. Faire pointer le domaine vers le serveur

Chez votre registraire de domaine (OVH, Gandi, GoDaddy, Cloudflare…), ajoutez un enregistrement DNS :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `hq` | l'adresse IP du serveur |

Attendez quelques minutes. Vérifiez depuis votre ordinateur : `ping hq.votre-agence.com` doit répondre avec l'IP du serveur.

> Sur Cloudflare, laissez le nuage **gris** (« DNS only ») : c'est Agent HQ qui obtient son certificat https.

## 3. Installer Docker sur le serveur

Connectez-vous au serveur, puis installez Docker et ouvrez uniquement les ports nécessaires :

```bash
ssh root@203.0.113.10

curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Récupérer Agent HQ

```bash
git clone --branch ccr-8f87a8f4-j058oi https://github.com/izo22/CleanConnect-Mobile.git
cd CleanConnect-Mobile/agent-hq
```

Le dépôt est privé : GitHub demande votre nom d'utilisateur, puis un **jeton d'accès** à la place du mot de passe. Créez ce jeton sur github.com → Settings → Developer settings → Personal access tokens, avec la seule permission *Contents : Read-only* sur ce dépôt.

## 5. Régler Agent HQ

```bash
cp .env.example .env
openssl rand -hex 24      # copiez le résultat : ce sera votre code d'accès
nano .env
```

Remplissez au minimum :

| Ligne | Quoi mettre |
|---|---|
| `DOMAIN=` | votre adresse, **sans** `https://` (ex. `hq.votre-agence.com`) |
| `APP_LANGUAGE=` | `en` pour un client américain (anglais, dollars), `fr` pour un client français (français, euros) |
| `ADMIN_TOKEN=` | le code généré juste avant (16 caractères minimum, sinon Agent HQ refuse de démarrer) |
| `ANTHROPIC_API_KEY=` | votre clé Claude (facultatif : sans clé, la relecture IA est coupée) |
| `NOTIFY_WEBHOOK_URL=` | un webhook Slack ou Teams pour être prévenu (facultatif) |

Enregistrez avec `Ctrl+O`, `Entrée`, puis quittez avec `Ctrl+X`.

> Utilisez une clé Claude **neuve**, jamais une clé qui a circulé dans un e-mail ou une conversation.

## 6. Lancer

```bash
docker compose up -d --build
```

La première fois, la construction prend 2 à 3 minutes. Ensuite :

```bash
docker compose ps            # « app » doit afficher (healthy)
```

Ouvrez `https://hq.votre-agence.com` dans votre navigateur et entrez le code d'accès. L'espace est vide : créez vos agents ou connectez n8n depuis **Connexions**.

Le certificat https est obtenu et renouvelé tout seul (Caddy et Let's Encrypt). Les visites en `http://` sont redirigées vers `https://`.

## Au quotidien

| Pour… | Commande (dans `CleanConnect-Mobile/agent-hq`) |
|---|---|
| Installer une nouvelle version | `git pull && docker compose up -d --build` |
| Voir ce qui se passe | `docker compose logs -f app` |
| Redémarrer | `docker compose restart app` |
| Changer le code d'accès | modifier `ADMIN_TOKEN` dans `.env`, puis `docker compose up -d` |
| Voir les sauvegardes | `docker compose exec app ls -l /data/backups` |

Une mise à jour ou un redémarrage ne fait rien perdre : les données sont dans un volume Docker séparé, et Agent HQ termine les requêtes en cours avant de s'arrêter.

## Sauvegardes

**Automatiques :** chaque jour, Agent HQ copie sa base dans `/data/backups` et garde les 30 derniers jours (`BACKUP_KEEP_DAYS`). La copie est faite à chaud, sans arrêter le service.

**Hors du serveur :** ces copies sont sur le même serveur. Si le serveur disparaît, elles disparaissent avec lui. Faites donc aussi l'une de ces deux choses :

- activez les **sauvegardes automatiques de l'hébergeur** (une option à cocher, souvent 20 à 30 % du prix du serveur) ;
- ou rapatriez les copies de temps en temps sur votre ordinateur :

  ```bash
  # sur le serveur
  docker compose cp app:/data/backups ./sauvegardes
  # sur votre ordinateur
  scp -r root@203.0.113.10:CleanConnect-Mobile/agent-hq/sauvegardes .
  ```

Les sauvegardes contiennent les clés de connexion de vos agents et de n8n : gardez-les en lieu sûr.

### Restaurer une sauvegarde

Remplacez la date par celle de la sauvegarde voulue :

```bash
docker compose stop app
docker compose run --rm --no-deps app sh -c 'cp /data/backups/agent-hq-2026-10-27.db /data/agent-hq.db && rm -f /data/agent-hq.db-wal /data/agent-hq.db-shm'
docker compose start app
```

Agent HQ repart exactement dans l'état de cette sauvegarde.

## Données et sécurité

- **Code d'accès obligatoire :** en ligne, Agent HQ refuse de démarrer sans `ADMIN_TOKEN` d'au moins 16 caractères. Les essais de code sont comparés en temps constant, et le code n'apparaît jamais dans les journaux.
- **Conservation :** l'activité détaillée des agents est effacée après 90 jours (`RETENTION_DAYS`). Les alertes, les décisions et le journal des actions humaines sont gardés.
- **Protections du navigateur :** https forcé (HSTS), page impossible à intégrer dans un autre site, scripts externes interdits.
- **Sorties :** Agent HQ n'envoie ses messages automatiques (Zapier, réponses aux workflows en attente) qu'à des adresses https publiques ou à votre serveur n8n connecté, jamais aux adresses internes du serveur.
- **Ce qui manque encore :** un code d'accès partagé par toute l'équipe, sans comptes nominatifs. Le journal ne sait donc pas encore *quel* humain a cliqué.

## Vérifier que tout va bien

Avant d'inviter un client pilote :

- [ ] `https://hq.votre-agence.com` s'ouvre, avec le cadenas, et demande le code ;
- [ ] `docker compose ps` affiche `app` en *healthy* ;
- [ ] `docker compose exec app ls /data/backups` montre une sauvegarde du jour ;
- [ ] les sauvegardes de l'hébergeur sont activées, ou une copie est sur votre ordinateur ;
- [ ] le code d'accès est envoyé au client **séparément** de l'adresse (par exemple l'adresse par e-mail, le code par SMS).

## Ensuite : brancher les outils des clients

- **n8n :** dans Agent HQ, **Connexions → Connecter un serveur n8n**. Voir [INTEGRATION-N8N.md](INTEGRATION-N8N.md).
- **Zapier :** maintenant qu'Agent HQ a une adresse https publique, l'application privée peut être publiée et testée dans Zapier. Voir [INTEGRATION-ZAPIER.md](INTEGRATION-ZAPIER.md).

## Ce qui a été vérifié

Sur cette configuration exacte (image Docker et Caddy) :

- refus de démarrer sans code d'accès ;
- https avec redirection depuis http, HSTS, compression, et mise à jour en direct de l'interface à travers Caddy ;
- bloc n8n généré avec l'adresse publique ;
- accès refusé sans le code, accepté avec ;
- code absent des journaux ;
- données intactes après un redémarrage ;
- arrêt propre en moins d'une seconde ;
- sauvegarde créée au démarrage, puis restaurée avec succès.

Le certificat Let's Encrypt réel, lui, ne peut être obtenu qu'avec votre vrai domaine : c'est la seule étape vérifiée seulement au premier lancement chez vous.

## Variante sans serveur à gérer

Les plateformes comme Railway, Render ou Fly.io savent lancer le `Dockerfile` de ce dossier et fournissent le https. Il faut alors :

- un **disque persistant** monté sur `/data` ;
- les variables `ADMIN_TOKEN`, `TRUST_PROXY=true` et `PUBLIC_URL=https://…` ;
- le dossier racine `agent-hq`.

Cette variante n'a pas été testée. Sans disque persistant, chaque redéploiement efface toutes les données.
