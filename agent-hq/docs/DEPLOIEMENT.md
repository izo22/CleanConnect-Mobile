# Mettre Orvanta en ligne

Ce guide met Orvanta sur Internet, en **https**, avec sauvegardes automatiques. Comptez environ 30 minutes la première fois. On copie-colle des commandes, il n'y a pas de code à écrire.

## Ce qu'il vous faut

| Quoi | Exemple | Coût indicatif |
|---|---|---|
| Un serveur Linux (VPS), 2 Go de mémoire, Ubuntu 24.04 | Hetzner, DigitalOcean, OVHcloud, Scaleway | 5 à 10 $ par mois |
| Un nom de domaine (ou un sous-domaine d'un domaine que vous avez déjà) | `hq.votre-agence.com` | 10 à 15 $ par an |
| Une clé Claude, si vous voulez la relecture par IA | console.anthropic.com | environ 0,4 centime par réponse relue |

**Pour démarrer sans rien payer :** Google Cloud offre une petite machine gratuite sans limite de durée aux États-Unis. Elle suffit pour tester et pour un premier client pilote. Voir [Variante gratuite : Google Cloud](#variante-gratuite--google-cloud) plus bas.

**Où louer le serveur :** si vos clients sont **aux États-Unis**, prenez un serveur aux États-Unis (Virginie, Oregon, New York…). Pour des clients **européens**, prenez l'Europe : les données restent dans l'UE (RGPD).

**Un serveur par client pilote.** Orvanta n'a pas encore de comptes séparés par client : tout le monde partage un même espace et un même code d'accès. En attendant, donnez à chaque agence pilote **son propre serveur et son propre sous-domaine** (`agence1.votre-hq.com`, `agence2.votre-hq.com`…). Leurs données restent ainsi totalement séparées.

## 1. Créer le serveur

Chez l'hébergeur, créez un serveur **Ubuntu 24.04** avec 2 Go de mémoire, dans la bonne région. Notez son **adresse IP** (par exemple `203.0.113.10`).

## 2. Faire pointer le domaine vers le serveur

Chez votre registraire de domaine (OVH, Gandi, GoDaddy, Cloudflare…), ajoutez un enregistrement DNS :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `hq` | l'adresse IP du serveur |

Attendez quelques minutes. Vérifiez depuis votre ordinateur : `ping hq.votre-agence.com` doit répondre avec l'IP du serveur.

> Sur Cloudflare, laissez le nuage **gris** (« DNS only ») : c'est Orvanta qui obtient son certificat https.

## 3. Installer Docker sur le serveur

Connectez-vous au serveur, puis installez Docker et ouvrez uniquement les ports nécessaires :

```bash
ssh root@203.0.113.10

curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Récupérer Orvanta

```bash
git clone --branch ccr-8f87a8f4-j058oi https://github.com/izo22/CleanConnect-Mobile.git
cd CleanConnect-Mobile/agent-hq
```

Le dépôt est privé : GitHub demande votre nom d'utilisateur, puis un **jeton d'accès** à la place du mot de passe. Créez ce jeton sur github.com → Settings → Developer settings → Personal access tokens, avec la seule permission *Contents : Read-only* sur ce dépôt.

## 5. Régler Orvanta

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
| `ADMIN_TOKEN=` | le code généré juste avant (16 caractères minimum, sinon Orvanta refuse de démarrer) |
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

## Le site public (page d'accueil)

Le dossier `site/` contient la page d'accueil d'Orvanta (en anglais), avec un formulaire « Request early access ». Les demandes arrivent dans l'application, menu **Early access**.

Pour la mettre en ligne sur le domaine principal (par exemple `orvantahq.io`, l'application restant sur `app.orvantahq.io`) :

1. Chez votre registraire (Cloudflare…), ajoutez **deux** enregistrements DNS vers l'adresse IP du serveur, nuage **gris** :

   | Type | Nom | Valeur |
   |---|---|---|
   | `A` | `@` (le domaine lui-même) | l'adresse IP du serveur |
   | `A` | `www` | l'adresse IP du serveur |

2. Sur le serveur :

   ```bash
   cd ~/CleanConnect-Mobile/agent-hq
   git pull
   grep -q '^SITE_DOMAIN=' .env || echo "SITE_DOMAIN=orvantahq.io" >> .env
   sudo docker compose up -d --build
   ```

`www.orvantahq.io` redirige vers `orvantahq.io`. Pour modifier un texte de la page, éditez `site/index.html` : pas besoin de reconstruire, le changement est visible au rechargement.

## Au quotidien

| Pour… | Commande (dans `CleanConnect-Mobile/agent-hq`) |
|---|---|
| Installer une nouvelle version | `git pull && docker compose up -d --build` |
| Voir ce qui se passe | `docker compose logs -f app` |
| Redémarrer | `docker compose restart app` |
| Changer le code d'accès | modifier `ADMIN_TOKEN` dans `.env`, puis `docker compose up -d` |
| Voir les sauvegardes | `docker compose exec app ls -l /data/backups` |

Une mise à jour ou un redémarrage ne fait rien perdre : les données sont dans un volume Docker séparé, et Orvanta termine les requêtes en cours avant de s'arrêter.

## Sauvegardes

**Automatiques :** chaque jour, Orvanta copie sa base dans `/data/backups` et garde les 30 derniers jours (`BACKUP_KEEP_DAYS`). La copie est faite à chaud, sans arrêter le service.

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

Orvanta repart exactement dans l'état de cette sauvegarde.

## Données et sécurité

- **Code d'accès obligatoire :** en ligne, Orvanta refuse de démarrer sans `ADMIN_TOKEN` d'au moins 16 caractères. Les essais de code sont comparés en temps constant, et le code n'apparaît jamais dans les journaux.
- **Conservation :** l'activité détaillée des agents est effacée après 90 jours (`RETENTION_DAYS`). Les alertes, les décisions et le journal des actions humaines sont gardés.
- **Protections du navigateur :** https forcé (HSTS), page impossible à intégrer dans un autre site, scripts externes interdits.
- **Sorties :** Orvanta n'envoie ses messages automatiques (Zapier, réponses aux workflows en attente) qu'à des adresses https publiques ou à votre serveur n8n connecté, jamais aux adresses internes du serveur.
- **Ce qui manque encore :** un code d'accès partagé par toute l'équipe, sans comptes nominatifs. Le journal ne sait donc pas encore *quel* humain a cliqué.

## Vérifier que tout va bien

Avant d'inviter un client pilote :

- [ ] `https://hq.votre-agence.com` s'ouvre, avec le cadenas, et demande le code ;
- [ ] `docker compose ps` affiche `app` en *healthy* ;
- [ ] `docker compose exec app ls /data/backups` montre une sauvegarde du jour ;
- [ ] les sauvegardes de l'hébergeur sont activées, ou une copie est sur votre ordinateur ;
- [ ] le code d'accès est envoyé au client **séparément** de l'adresse (par exemple l'adresse par e-mail, le code par SMS).

## Ensuite : brancher les outils des clients

- **n8n :** dans Orvanta, **Connexions → Connecter un serveur n8n**. Voir [INTEGRATION-N8N.md](INTEGRATION-N8N.md).
- **Zapier :** maintenant qu'Orvanta a une adresse https publique, l'application privée peut être publiée et testée dans Zapier. Voir [INTEGRATION-ZAPIER.md](INTEGRATION-ZAPIER.md).
- **Clients américains :** envoyez-leur les guides en anglais, [en/connect-n8n.md](en/connect-n8n.md) et [en/connect-zapier.md](en/connect-zapier.md).

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

## Variante gratuite : Google Cloud

Google offre une petite machine (« e2-micro ») **gratuite sans limite de durée** dans trois régions des États-Unis. Elle remplace les étapes 1 à 3 ci-dessus ; la suite (étapes 4, 5 et 6) est identique.

**Ce qu'elle vaut :** 1 Go de mémoire (assez pour Orvanta ; on ajoute de la mémoire de secours pour l'installation), 30 Go de disque, 1 Go de trafic sortant gratuit par mois (au-delà, quelques centimes). Il n'y a pas de support. Une seule machine gratuite par compte. Pour un client qui paie, passez sur un serveur payant : le déménagement consiste à copier une sauvegarde.

### G1. Créer le compte

1. Allez sur **cloud.google.com/free** → *Get started for free*. Une carte bancaire est demandée pour vérifier votre identité ; rien n'est prélevé tant que vous restez dans les limites gratuites.
2. Tout de suite après : **Facturation → Budgets et alertes → Créer un budget** de **1 $**, avec alerte par e-mail. Vous serez prévenu au premier centime dépensé.

### G2. Créer la machine

Dans la console : **Compute Engine → Instances de VM → Créer une instance** (si Google le demande, activez l'API Compute Engine, cela prend une minute).

| Réglage | Valeur |
|---|---|
| Nom | `agent-hq` |
| Région | `us-east1` (Caroline du Sud), `us-central1` (Iowa) ou `us-west1` (Oregon). **Uniquement** ces trois : ailleurs, c'est payant. |
| Machine | série **E2**, type **e2-micro** |
| Disque de démarrage | **Modifier** → **Ubuntu 24.04 LTS**, type **Disque persistant standard** (*Standard persistent disk*), **30 Go**. Le type proposé par défaut (« équilibré », *Balanced*) n'est **pas** gratuit. |
| Pare-feu (partie réseau) | cocher **Autoriser le trafic HTTP** et **Autoriser le trafic HTTPS** |

Avant de cliquer sur **Créer**, regardez l'estimation de coût affichée à droite. L'adresse IP publique de la machine peut être facturée quelques dollars par mois selon les règles de Google du moment : si l'estimation n'est pas à zéro, c'est probablement elle, et le budget d'alerte vous préviendra de toute façon.

Notez l'**adresse IP externe** de la machine dans la liste des instances.

### G3. Une adresse gratuite (si vous n'avez pas de nom de domaine)

1. Allez sur **duckdns.org** et connectez-vous (avec Google ou GitHub).
2. Choisissez un nom, par exemple `monagence-hq`, puis collez l'adresse IP externe et cliquez sur **update ip**.
3. Votre adresse est `monagence-hq.duckdns.org`. C'est elle que vous mettrez dans `DOMAIN=` à l'étape 5. Le https fonctionne exactement pareil.

Si vous avez déjà un nom de domaine, suivez simplement l'étape 2 avec l'adresse IP externe.

### G4. Préparer la machine

Dans la liste des instances, cliquez sur le bouton **SSH** à côté de la machine : un terminal s'ouvre dans le navigateur, il n'y a rien à installer. Collez :

```bash
# Mémoire de secours (2 Go) pour que l'installation ne manque pas de mémoire
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Fermez la fenêtre SSH et rouvrez-la, pour que l'accès à Docker soit pris en compte. Inutile d'installer un pare-feu : celui de Google est déjà actif.

Continuez ensuite avec les **étapes 4, 5 et 6** ci-dessus. La première construction est plus lente que sur un serveur payant (5 à 10 minutes) : c'est normal.

### Si l'adresse IP change

L'adresse IP externe par défaut peut changer si vous **arrêtez** puis relancez la machine (pas lors d'un simple redémarrage). Si cela arrive, mettez-la à jour sur DuckDNS ou chez votre registraire. Pour la figer, réservez-la comme adresse statique (**Réseau VPC → Adresses IP**), en vérifiant le coût affiché.

> Cette variante suit les règles de l'offre gratuite de Google telles que publiées en 2026. Elle n'a pas pu être testée de bout en bout depuis ici : faites confiance à l'estimation de coût de la console et au budget d'alerte.

## Variante sans serveur à gérer

Les plateformes comme Railway, Render ou Fly.io savent lancer le `Dockerfile` de ce dossier et fournissent le https. Il faut alors :

- un **disque persistant** monté sur `/data` ;
- les variables `ADMIN_TOKEN`, `TRUST_PROXY=true` et `PUBLIC_URL=https://…` ;
- le dossier racine `agent-hq`.

Cette variante n'a pas été testée. Sans disque persistant, chaque redéploiement efface toutes les données. Les offres gratuites de ces plateformes ne conviennent pas : le service s'endort après quelques minutes sans visite et n'a pas de disque persistant.
