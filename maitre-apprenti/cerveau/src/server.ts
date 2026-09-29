// Serveur HTTP du cerveau : API pour les lunettes, pages web pour le maître et la tablette.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerSession, sessionsDeLecon, trouverSession } from "./coach.ts";
import { CaptureMaitre, creerLeconDepuisVideo, demarrerCapture } from "./lecons.ts";
import { cheminMedia, listerLecons, lireLecon, supprimerLecon } from "./store.ts";
import type { Commande, Lecon } from "./types.ts";
import { sequenceDepuisMorceau, type MorceauVideo } from "./video.ts";

const PORT = Number(process.env.PORT ?? 8787);
/** Si défini, chaque appel à l'API doit fournir cette clé (en-tête x-cle ou paramètre ?cle=). */
const CLE_ACCES = process.env.CLE_ACCES ?? "";
const TAILLE_MAX_VIDEO = 1024 * 1024 * 1024;
/** Un morceau de quelques secondes (tablette, lunettes). */
const TAILLE_MAX_MORCEAU = 50 * 1024 * 1024;
const DOSSIER_PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const captures = new Map<string, CaptureMaitre>();

class ErreurHttp extends Error {
  readonly statut: number;
  constructor(statut: number, message: string) {
    super(message);
    this.statut = statut;
  }
}

function envoyerJson(res: ServerResponse, statut: number, corps: unknown): void {
  res.writeHead(statut, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corps));
}

async function lireCorps(req: IncomingMessage, tailleMax: number): Promise<Buffer> {
  const morceaux: Buffer[] = [];
  let taille = 0;
  for await (const morceau of req) {
    taille += (morceau as Buffer).length;
    if (taille > tailleMax) throw new ErreurHttp(413, "Fichier trop volumineux");
    morceaux.push(morceau as Buffer);
  }
  return Buffer.concat(morceaux);
}

async function lireJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const corps = await lireCorps(req, 1024 * 1024);
  if (corps.length === 0) return {};
  try {
    return JSON.parse(corps.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new ErreurHttp(400, "JSON invalide");
  }
}

/**
 * Lit un morceau de vidéo envoyé pendant une leçon ou une démonstration : fichier (MP4, WebM…)
 * ou flux HEVC brut des lunettes Meta (type video/hevc, cadence dans ?ips=).
 */
async function lireMorceau(req: IncomingMessage, url: URL): Promise<MorceauVideo> {
  const type = req.headers["content-type"] ?? "";
  if (!type.startsWith("video/") && type !== "application/octet-stream") {
    throw new ErreurHttp(415, "Morceau de vidéo attendu (video/mp4, video/webm, video/hevc…)");
  }
  const donnees = await lireCorps(req, TAILLE_MAX_MORCEAU);
  if (donnees.length === 0) throw new ErreurHttp(400, "Morceau de vidéo vide");
  const ips = Number(url.searchParams.get("ips") ?? "");
  return { donnees, type, imagesParSeconde: ips > 0 && ips <= 60 ? ips : undefined };
}

/** Nom d'hôte public du serveur, pour construire l'adresse du direct RTMP. */
function hote(req: IncomingMessage): string {
  return (req.headers.host ?? "localhost").replace(/:\d+$/, "");
}

const TYPES_FICHIERS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
};

/** Envoie un fichier, avec prise en charge des requêtes partielles (nécessaire aux vidéos). */
async function envoyerFichier(req: IncomingMessage, res: ServerResponse, chemin: string): Promise<void> {
  let taille: number;
  try {
    const infos = await stat(chemin);
    if (!infos.isFile()) throw new Error();
    taille = infos.size;
  } catch {
    throw new ErreurHttp(404, "Fichier introuvable");
  }
  const type = TYPES_FICHIERS[path.extname(chemin)] ?? "application/octet-stream";
  const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (plage && (plage[1] || plage[2])) {
    const debut = plage[1] ? Number(plage[1]) : Math.max(0, taille - Number(plage[2]));
    const fin = plage[1] && plage[2] ? Math.min(Number(plage[2]), taille - 1) : taille - 1;
    if (debut > fin || debut >= taille) {
      res.writeHead(416, { "content-range": `bytes */${taille}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "content-type": type,
      "content-length": fin - debut + 1,
      "content-range": `bytes ${debut}-${fin}/${taille}`,
      "accept-ranges": "bytes",
    });
    createReadStream(chemin, { start: debut, end: fin }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "content-length": taille, "accept-ranges": "bytes" });
  createReadStream(chemin).pipe(res);
}

function verifierCle(req: IncomingMessage, url: URL): void {
  if (!CLE_ACCES) return;
  if (req.headers["x-cle"] === CLE_ACCES || url.searchParams.get("cle") === CLE_ACCES) return;
  throw new ErreurHttp(401, "Clé d'accès manquante ou incorrecte");
}

function resumeLecon(lecon: Lecon) {
  return {
    id: lecon.id,
    titre: lecon.titre,
    metier: lecon.metier,
    source: lecon.source,
    creeLe: lecon.creeLe,
    statut: lecon.statut,
    erreur: lecon.erreur,
    nombreEtapes: lecon.etapes.length,
  };
}

function session(id: string) {
  const trouvee = trouverSession(id);
  if (!trouvee) throw new ErreurHttp(404, "Session introuvable ou expirée");
  return trouvee;
}

function capture(id: string) {
  const trouvee = captures.get(id);
  if (!trouvee || trouvee.termine) throw new ErreurHttp(404, "Démonstration introuvable ou déjà terminée");
  return trouvee;
}

const COMMANDES: Commande[] = ["suivant", "precedent", "repeter", "recommencer"];

async function router(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const methode = req.method ?? "GET";
  const segments = url.pathname.split("/").filter(Boolean);

  // --- Pages et médias -------------------------------------------------------
  if (methode === "GET" && !url.pathname.startsWith("/api/")) {
    if (segments[0] === "media" && segments[1] === "lecons" && segments.length === 5) {
      const [, , id, type, fichier] = segments;
      const chemin = type === "images" || type === "clips" ? cheminMedia(id, type, fichier) : null;
      if (!chemin) throw new ErreurHttp(404, "Média introuvable");
      return envoyerFichier(req, res, chemin);
    }
    const nom = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^[\w-]+\.(html|css|js|svg|png)$/.test(nom)) throw new ErreurHttp(404, "Page introuvable");
    return envoyerFichier(req, res, path.join(DOSSIER_PUBLIC, nom));
  }

  if (segments[0] !== "api") throw new ErreurHttp(404, "Route inconnue");
  verifierCle(req, url);
  const route = `${methode} /${segments.slice(1).map((s, i) => (i % 2 === 1 ? ":id" : s)).join("/")}`;
  const id = segments[2] ?? "";

  switch (route) {
    // --- Leçons -------------------------------------------------------------
    case "GET /lecons":
      return envoyerJson(res, 200, (await listerLecons()).map(resumeLecon));

    case "POST /lecons": {
      const video = await lireCorps(req, TAILLE_MAX_VIDEO);
      if (video.length === 0) throw new ErreurHttp(400, "Envoie la vidéo du maître dans le corps de la requête");
      const lecon = await creerLeconDepuisVideo({
        titre: url.searchParams.get("titre") ?? "",
        metier: url.searchParams.get("metier") ?? "",
        commentaire: url.searchParams.get("commentaire") ?? "",
        video,
      });
      return envoyerJson(res, 202, lecon);
    }

    case "GET /lecons/:id": {
      const lecon = await lireLecon(id);
      if (!lecon) throw new ErreurHttp(404, "Leçon introuvable");
      return envoyerJson(res, 200, lecon);
    }

    case "DELETE /lecons/:id":
      await supprimerLecon(id);
      return envoyerJson(res, 200, { ok: true });

    // --- Démonstration du maître en direct avec les lunettes -----------------
    case "POST /captures": {
      const corps = await lireJson(req);
      const nouvelle = await demarrerCapture(String(corps.titre ?? ""), String(corps.metier ?? ""));
      captures.set(nouvelle.lecon.id, nouvelle);
      return envoyerJson(res, 201, { captureId: nouvelle.lecon.id, lecon: nouvelle.lecon });
    }

    case "POST /captures/:id/video": {
      await capture(id).ajouterMorceau(await lireMorceau(req, url));
      return envoyerJson(res, 200, { ok: true });
    }

    case "POST /captures/:id/direct": {
      const direct = await capture(id).demarrerDirect();
      return envoyerJson(res, 201, { rtmpUrl: direct.url(hote(req)) });
    }

    case "POST /captures/:id/parole": {
      const { texte } = await lireJson(req);
      capture(id).ajouterParole(String(texte ?? ""));
      return envoyerJson(res, 200, { ok: true });
    }

    case "POST /captures/:id/etape":
      return envoyerJson(res, 200, { t: capture(id).marquerEtape() });

    case "POST /captures/:id/terminer": {
      const enCours = capture(id);
      captures.delete(id);
      await enCours.terminer();
      return envoyerJson(res, 202, { leconId: enCours.lecon.id });
    }

    // --- Sessions d'apprentissage -------------------------------------------
    case "POST /sessions": {
      const { leconId } = await lireJson(req);
      const lecon = await lireLecon(String(leconId ?? ""));
      if (!lecon) throw new ErreurHttp(404, "Leçon introuvable");
      if (lecon.statut !== "prete") throw new ErreurHttp(409, "Cette leçon n'est pas encore prête");
      return envoyerJson(res, 201, creerSession(lecon).etat);
    }

    case "GET /sessions": {
      // Seulement les sessions actives ces 2 dernières minutes (les lunettes envoient de la vidéo en continu).
      const leconId = url.searchParams.get("lecon") ?? "";
      const actives = sessionsDeLecon(leconId).filter((s) => Date.now() - s.derniereActivite < 120_000);
      return envoyerJson(res, 200, actives.map((s) => s.etat));
    }

    case "GET /sessions/:id":
      return envoyerJson(res, 200, session(id).etat);

    case "POST /sessions/:id/video": {
      const enCours = session(id);
      let sequence: Buffer[];
      try {
        sequence = await sequenceDepuisMorceau(await lireMorceau(req, url));
      } catch (erreur) {
        if (erreur instanceof ErreurHttp) throw erreur;
        throw new ErreurHttp(422, erreur instanceof Error ? erreur.message : String(erreur));
      }
      return envoyerJson(res, 200, await enCours.analyserSequence(sequence));
    }

    case "POST /sessions/:id/direct": {
      const direct = session(id).ouvrirDirect();
      return envoyerJson(res, 201, { rtmpUrl: direct.url(hote(req)) });
    }

    case "DELETE /sessions/:id/direct":
      await session(id).fermerDirect();
      return envoyerJson(res, 200, { ok: true });

    case "POST /sessions/:id/commande": {
      const { commande } = await lireJson(req);
      if (!COMMANDES.includes(commande as Commande)) {
        throw new ErreurHttp(400, `Commande inconnue (attendu : ${COMMANDES.join(", ")})`);
      }
      return envoyerJson(res, 200, session(id).commande(commande as Commande));
    }

    case "GET /sessions/:id/evenements": {
      // Flux d'événements pour la tablette : chaque retour des lunettes y est relayé en direct.
      const enCours = session(id);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const envoyer = (retour: unknown) => res.write(`data: ${JSON.stringify(retour)}\n\n`);
      envoyer(enCours.etat);
      const desabonner = enCours.abonner(envoyer);
      const battement = setInterval(() => res.write(": ok\n\n"), 25_000);
      req.on("close", () => {
        clearInterval(battement);
        desabonner();
      });
      return;
    }
  }
  throw new ErreurHttp(404, "Route inconnue");
}

export const serveur = createServer((req, res) => {
  // Les lunettes et la tablette peuvent être servies depuis une autre origine (appli Mentra, etc.).
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, x-cle");
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  router(req, res).catch((erreur: unknown) => {
    const statut = erreur instanceof ErreurHttp ? erreur.statut : 500;
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    if (statut === 500) console.error(erreur);
    if (res.headersSent) res.end();
    else envoyerJson(res, statut, { erreur: message });
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serveur.listen(PORT, () => {
    console.log(`Cerveau Maître-Apprenti prêt sur http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("Note : ANTHROPIC_API_KEY n'est pas défini. Sans autre identifiant configuré, l'IA ne répondra pas.");
    }
  });
}
