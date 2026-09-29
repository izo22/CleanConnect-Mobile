// Serveur HTTP du cerveau : API pour les lunettes, pages web pour le maître et la tablette.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerSession, sessionsDeLecon, trouverSession } from "./coach.ts";
import { CaptureMaitre, creerLeconDepuisVideo, demarrerCapture } from "./lecons.ts";
import { annoter, calculerMetriques, cheminImageSeance, lireSeance, seancesDeLecon } from "./journal.ts";
import { cheminMedia, listerLecons, lireLecon, nouvelId, sauverLecon, supprimerLecon } from "./store.ts";
import type { Avis, Commande, Etape, Lecon, Regle } from "./types.ts";
import { cadenceValide, imagesDepuisMorceau, type MorceauVideo } from "./video.ts";

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

/** Modifie une leçon prête et transmet le changement aux séances en cours (règles, cadence). */
async function modifierLecon(id: string, modifier: (lecon: Lecon) => void): Promise<Lecon> {
  const lecon = await lireLecon(id);
  if (!lecon) throw new ErreurHttp(404, "Leçon introuvable");
  modifier(lecon);
  await sauverLecon(lecon);
  for (const enCours of sessionsDeLecon(id)) enCours.majLecon(lecon);
  return lecon;
}

function nouvelleRegle(texte: unknown, etapeId: unknown, lecon: Lecon, source: string | null): Regle {
  const propre = typeof texte === "string" ? texte.trim().slice(0, 500) : "";
  if (!propre) throw new ErreurHttp(400, "La règle est vide");
  if (etapeId !== null && !lecon.etapes.some((e) => e.id === etapeId)) throw new ErreurHttp(400, "Étape inconnue");
  return { id: nouvelId(), etapeId: etapeId as string | null, texte: propre, creeLe: new Date().toISOString(), source };
}

/** Texte d'une étape modifié par le maître (fiche écrite) : chaque champ envoyé remplace l'ancien. */
function modifierTexteEtape(etape: Etape, corps: Record<string, unknown>): void {
  const texte = (valeur: unknown, max: number) => {
    if (typeof valeur !== "string") throw new ErreurHttp(400, "Texte attendu");
    return valeur.trim().slice(0, max);
  };
  const liste = (valeur: unknown) => {
    if (!Array.isArray(valeur)) throw new ErreurHttp(400, "Liste de phrases attendue");
    return valeur.map((v) => texte(v, 300)).filter(Boolean).slice(0, 20);
  };
  if ("titre" in corps) etape.titre = texte(corps.titre, 80) || etape.titre;
  if ("consigne" in corps) {
    const consigne = texte(corps.consigne, 400);
    if (!consigne) throw new ErreurHttp(400, "La consigne ne peut pas être vide");
    etape.consigne = consigne;
  }
  if ("explication" in corps) etape.explication = texte(corps.explication, 2000);
  if ("pointsDeControle" in corps) etape.pointsDeControle = liste(corps.pointsDeControle);
  if ("erreursFrequentes" in corps) etape.erreursFrequentes = liste(corps.erreursFrequentes);
  if ("criteresDeReussite" in corps) etape.criteresDeReussite = liste(corps.criteresDeReussite);
}

const AVIS: Avis[] = ["juste", "fausse", "inutile", "ok", "manquee"];

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

const COMMANDES: Commande[] = ["suivant", "precedent", "repeter", "recommencer", "verifier", "expliquer"];

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

    // --- Réglages et règles du maître ---------------------------------------
    case "POST /lecons/:id/reglages": {
      // Chaque réglage envoyé est modifié ; les autres restent tels quels.
      const corps = await lireJson(req);
      const lecon = await modifierLecon(id, (l) => {
        if ("imagesParSeconde" in corps) l.imagesParSeconde = cadenceValide(corps.imagesParSeconde);
        if ("verificationAuto" in corps) l.verificationAuto = corps.verificationAuto === true;
        if ("etapesSurveillees" in corps) {
          if (!Array.isArray(corps.etapesSurveillees)) throw new ErreurHttp(400, "etapesSurveillees : liste d'étapes attendue");
          const surveillees = new Set(corps.etapesSurveillees);
          for (const etape of l.etapes) etape.surveiller = surveillees.has(etape.id);
        }
      });
      return envoyerJson(res, 200, {
        imagesParSeconde: cadenceValide(lecon.imagesParSeconde),
        verificationAuto: lecon.verificationAuto === true,
        etapesSurveillees: lecon.etapes.filter((e) => e.surveiller).map((e) => e.id),
      });
    }

    case "POST /lecons/:id/etapes/:id": {
      // Le maître relit et corrige le texte d'une étape ; l'IA s'appuie ensuite sur ce texte.
      const corps = await lireJson(req);
      let modifiee: Etape | null = null;
      await modifierLecon(id, (l) => {
        const etape = l.etapes.find((e) => e.id === segments[4]);
        if (!etape) throw new ErreurHttp(404, "Étape introuvable");
        modifierTexteEtape(etape, corps);
        modifiee = etape;
      });
      return envoyerJson(res, 200, modifiee);
    }

    case "POST /lecons/:id/regles": {
      const { texte, etapeId } = await lireJson(req);
      let regle: Regle | null = null;
      await modifierLecon(id, (l) => {
        regle = nouvelleRegle(texte, etapeId ?? null, l, null);
        l.regles = [...(l.regles ?? []), regle];
      });
      return envoyerJson(res, 201, regle);
    }

    case "DELETE /lecons/:id/regles/:id": {
      const regleId = segments[4];
      const lecon = await modifierLecon(id, (l) => (l.regles = (l.regles ?? []).filter((r) => r.id !== regleId)));
      return envoyerJson(res, 200, lecon.regles);
    }

    // --- Évaluation du pilote : journal, avis du maître, métriques ------------
    case "GET /lecons/:id/seances": {
      const seances = await seancesDeLecon(id);
      return envoyerJson(
        res,
        200,
        seances.map(({ seance, interventions }) => ({
          ...seance,
          analyses: interventions.length,
          correctionsDites: interventions.filter((i) => i.verdict === "correction" && i.dit).length,
          jugees: interventions.filter((i) => i.annotation).length,
        })),
      );
    }

    case "GET /lecons/:id/metriques": {
      const lecon = await lireLecon(id);
      if (!lecon) throw new ErreurHttp(404, "Leçon introuvable");
      return envoyerJson(res, 200, calculerMetriques(lecon, await seancesDeLecon(id)));
    }

    case "GET /seances/:id": {
      const seance = await lireSeance(id);
      if (!seance) throw new ErreurHttp(404, "Séance introuvable");
      return envoyerJson(res, 200, seance);
    }

    case "GET /seances/:id/images/:id": {
      const chemin = cheminImageSeance(id, segments[4] ?? "");
      if (!chemin) throw new ErreurHttp(404, "Image introuvable");
      return envoyerFichier(req, res, chemin);
    }

    case "POST /seances/:id/interventions/:id/annotation": {
      const corps = await lireJson(req);
      if (!AVIS.includes(corps.avis as Avis)) throw new ErreurHttp(400, `Avis inconnu (attendu : ${AVIS.join(", ")})`);
      const commentaire = typeof corps.commentaire === "string" ? corps.commentaire.trim().slice(0, 500) : "";
      const lue = await lireSeance(id);
      const intervention = lue?.interventions.find((i) => i.id === segments[4]);
      if (!lue || !intervention) throw new ErreurHttp(404, "Intervention introuvable");

      // Le maître corrige l'IA : son explication devient une règle de la leçon.
      let regle: Regle | null = null;
      if (corps.regle === true) {
        await modifierLecon(lue.seance.leconId, (l) => {
          const etapeId = corps.portee === "lecon" ? null : intervention.etapeId;
          regle = nouvelleRegle(commentaire, etapeId, l, `${id}/${intervention.id}`);
          l.regles = [...(l.regles ?? []), regle];
        });
      }
      const annotee = await annoter(id, intervention.id, {
        avis: corps.avis as Avis,
        commentaire,
        regleId: (regle as Regle | null)?.id ?? null,
        le: new Date().toISOString(),
      });
      return envoyerJson(res, 200, { intervention: annotee, regle });
    }

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
      const { leconId, apprenti } = await lireJson(req);
      const lecon = await lireLecon(String(leconId ?? ""));
      if (!lecon) throw new ErreurHttp(404, "Leçon introuvable");
      if (lecon.statut !== "prete") throw new ErreurHttp(409, "Cette leçon n'est pas encore prête");
      return envoyerJson(res, 201, creerSession(lecon, typeof apprenti === "string" ? apprenti : "").etat);
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
      // ?commande=verifier ou ?commande=suivant : la vidéo accompagne la demande de l'apprenti.
      const enCours = session(id);
      const commande = url.searchParams.get("commande");
      if (commande !== null && commande !== "verifier" && commande !== "suivant") {
        throw new ErreurHttp(400, "commande : verifier ou suivant");
      }
      let images: Buffer[];
      try {
        images = await imagesDepuisMorceau(await lireMorceau(req, url), enCours.imagesParSeconde);
      } catch (erreur) {
        if (erreur instanceof ErreurHttp) throw erreur;
        throw new ErreurHttp(422, erreur instanceof Error ? erreur.message : String(erreur));
      }
      return envoyerJson(res, 200, await enCours.recevoirVideo(images, commande ?? undefined));
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
      return envoyerJson(res, 200, await session(id).commande(commande as Commande));
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
