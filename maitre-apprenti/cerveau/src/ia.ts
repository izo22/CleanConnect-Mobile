// Appels à Claude : construire une leçon à partir des images du maître, puis juger l'apprenti.

import Anthropic from "@anthropic-ai/sdk";
import type { Consommation, Etape, Parole, TypeVerdict, Verdict } from "./types.ts";

const MODELE = process.env.MODELE_IA ?? "claude-opus-5-5";

let client: Anthropic | null = null;
function claude(): Anthropic {
  // Créé à la demande : le serveur démarre même sans clé, pour tester l'interface.
  client ??= new Anthropic();
  return client;
}

export interface ImageIA {
  data: Buffer;
  /** Instant dans la vidéo du maître, en secondes (pour la construction de leçon). */
  t?: number;
}

type TypeMedia = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export function typeMedia(data: Buffer): TypeMedia | null {
  if (data[0] === 0xff && data[1] === 0xd8) return "image/jpeg";
  if (data.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") {
    return "image/webp";
  }
  if (data.subarray(0, 3).toString() === "GIF") return "image/gif";
  return null;
}

function blocImage(image: ImageIA): Anthropic.Beta.BetaImageBlockParam {
  const media = typeMedia(image.data);
  if (!media) throw new Error("Format d'image non reconnu (JPEG, PNG, WebP ou GIF attendu)");
  return {
    type: "image",
    source: { type: "base64", media_type: media, data: image.data.toString("base64") },
  };
}

function texteReponse(reponse: Anthropic.Beta.BetaMessage): string {
  if (reponse.stop_reason === "refusal") {
    throw new Error(`L'IA a refusé la demande (${reponse.stop_details?.category ?? "sans catégorie"})`);
  }
  const bloc = reponse.content.find((b) => b.type === "text");
  if (!bloc || bloc.type !== "text") throw new Error("Réponse de l'IA sans texte");
  return bloc.text;
}

// ---------------------------------------------------------------------------
// 1. Construire la leçon à partir de la démonstration du maître
// ---------------------------------------------------------------------------

export interface EtapeBrute {
  titre: string;
  consigne: string;
  explication: string;
  debut_s: number;
  fin_s: number;
  points_de_controle: string[];
  erreurs_frequentes: string[];
  criteres_de_reussite: string[];
}

const SCHEMA_LECON = {
  type: "object",
  properties: {
    etapes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titre: { type: "string" },
          consigne: { type: "string" },
          explication: { type: "string" },
          debut_s: { type: "number" },
          fin_s: { type: "number" },
          points_de_controle: { type: "array", items: { type: "string" } },
          erreurs_frequentes: { type: "array", items: { type: "string" } },
          criteres_de_reussite: { type: "array", items: { type: "string" } },
        },
        required: [
          "titre", "consigne", "explication", "debut_s", "fin_s", "points_de_controle",
          "erreurs_frequentes", "criteres_de_reussite",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["etapes"],
  additionalProperties: false,
} as const;

const SYSTEME_LECON = `Tu prépares une leçon pratique à partir de la démonstration filmée d'un maître artisan.
Un apprenti refera ensuite les mêmes gestes avec des lunettes connectées qui le filment, et une IA comparera ses gestes à ceux du maître, étape par étape, à partir de courtes séquences vidéo.

Découpe la démonstration en étapes concrètes, dans l'ordre (en général entre 4 et 12). Pour chaque étape :
- titre : 2 à 6 mots.
- consigne : ce que l'apprenti doit faire, en une ou deux phrases à l'impératif, en tutoyant. Elle sera lue à voix haute.
- explication : le détail du geste pour la fiche écrite de l'apprenti, en 2 à 5 phrases courtes à l'impératif, en tutoyant : comment tenir l'outil ou la matière, dans quel sens et avec quelle amplitude bouger, jusqu'à quand. Reprends les mots et les astuces du maître quand il en donne.
- debut_s et fin_s : les instants de début et de fin dans la vidéo, en secondes, d'après les instants indiqués sous chaque image.
- points_de_controle : ce qui doit se voir dans le geste pendant l'étape (bon outil, bonne quantité lue sur la balance, ordre des mouvements, sens et amplitude du geste, position des mains, rythme...).
- erreurs_frequentes : les erreurs visibles typiques d'un débutant sur cette étape (geste, ordre, résultat).
- criteres_de_reussite : à quoi on voit que l'étape est terminée et réussie (souvent le résultat visible).

Ne décris que ce qui se voit sur les images ou ce que le maître dit. N'invente pas de quantités, de températures ou de durées qui n'apparaissent pas. Rédige en français.`;

export async function construireLecon(options: {
  titre: string;
  metier: string;
  images: ImageIA[];
  duree: number | null;
  paroles?: Parole[];
  reperes?: number[];
  commentaire?: string;
}): Promise<EtapeBrute[]> {
  const contenu: Anthropic.Beta.BetaContentBlockParam[] = [];
  let intro = `Leçon : « ${options.titre} » (métier : ${options.metier}).\n`;
  if (options.duree !== null) intro += `Durée de la démonstration : ${Math.round(options.duree)} s.\n`;
  intro += `Voici ${options.images.length} images extraites de la vidéo de la démonstration, dans l'ordre.`;
  contenu.push({ type: "text", text: intro });

  options.images.forEach((image, i) => {
    contenu.push({ type: "text", text: `#${i} — t = ${image.t ?? 0} s` });
    contenu.push(blocImage(image));
  });

  if (options.paroles?.length) {
    const lignes = options.paroles.map((p) => `[${p.t} s] ${p.texte}`).join("\n");
    contenu.push({ type: "text", text: `Ce que le maître a dit pendant la démonstration :\n${lignes}` });
  }
  if (options.reperes?.length) {
    contenu.push({
      type: "text",
      text: `Le maître a signalé un changement d'étape à ces instants (en secondes) : ${options.reperes.join(", ")}. Utilise-les comme limites d'étapes.`,
    });
  }
  if (options.commentaire?.trim()) {
    contenu.push({ type: "text", text: `Explications du maître :\n${options.commentaire.trim()}` });
  }
  contenu.push({ type: "text", text: "Découpe maintenant cette démonstration en étapes." });

  // Requête longue (beaucoup d'images, réflexion) : on passe par le streaming pour éviter les délais d'attente.
  const flux = claude().beta.messages.stream({
    model: MODELE,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA_LECON } },
    system: SYSTEME_LECON,
    messages: [{ role: "user", content: contenu }],
  });
  const reponse = await flux.finalMessage();
  const resultat = JSON.parse(texteReponse(reponse)) as { etapes: EtapeBrute[] };
  if (!resultat.etapes.length) throw new Error("L'IA n'a trouvé aucune étape dans la démonstration");
  return resultat.etapes;
}

// ---------------------------------------------------------------------------
// 2. Juger ce que fait l'apprenti pendant une étape
// ---------------------------------------------------------------------------

const SCHEMA_VERDICT = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["en_cours", "correction", "etape_reussie", "pas_visible"] },
    message: { type: "string" },
    points_valides: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "message", "points_valides"],
  additionalProperties: false,
} as const;

/**
 * Variante où l'IA décrit d'abord ce que font les mains d'une image à l'autre (sens, ordre du
 * mouvement), puis juge : l'observation vient avant le verdict dans la réponse.
 */
const SCHEMA_VERDICT_OBSERVE = {
  type: "object",
  properties: {
    observation: { type: "string" },
    verdict: SCHEMA_VERDICT.properties.verdict,
    message: SCHEMA_VERDICT.properties.message,
    points_valides: SCHEMA_VERDICT.properties.points_valides,
  },
  required: ["observation", "verdict", "message", "points_valides"],
  additionalProperties: false,
} as const;

const SYSTEME_TUTEUR = `Tu es le tuteur d'un apprenti artisan. Il est filmé par des lunettes connectées (vu de ses yeux) ou par un téléphone posé devant son plan de travail. Tu reçois des extraits vidéo sous forme d'images successives : le déroulé de l'étape en cours chez le maître, puis les dernières secondes de l'apprenti. Tu compares ses gestes à ceux du maître et tu lui parles à l'oreille. Tu es l'interprète du maître : quand il a donné des règles, elles priment sur ton propre jugement.

Réponds avec un verdict :
- "correction" : une erreur est clairement visible dans le geste ou le résultat (mauvais mouvement, mauvais ordre, mauvais outil, geste trop brusque ou trop timide, forme ratée). Le message dit quoi faire, pas ce qui ne va pas : une seule correction, la plus importante, à l'impératif, en tutoyant, en 15 mots maximum. Exemple : « Roule du centre vers les bords, en écartant les mains. »
- "etape_reussie" : les critères de réussite de l'étape sont clairement visibles à la fin de l'extrait. Le message est un bravo très court.
- "en_cours" : l'apprenti travaille, rien de faux n'est visible, ou tu as un doute. Message vide, sauf si l'apprenti t'a demandé de vérifier (voir plus bas).
- "pas_visible" : on ne voit pas ses mains ni son plan de travail. Le message lui dit comment se placer, en 12 mots maximum.

Règles :
- Regarde le mouvement d'une image à l'autre : sens, amplitude, ordre et rythme des gestes, pas seulement la dernière image. Quand les images sont datées, compare surtout des images proches dans le temps : c'est entre elles que se voit le sens du mouvement (vers le centre ou vers les bords, vers soi ou vers l'avant, qui s'enroule ou qui se déroule).
- Le maître est montré sur toute l'étape, l'apprenti sur quelques secondes : compare le geste en cours avec le passage correspondant chez le maître.
- Ne juge que ce qui se voit. Tu ne sens pas la pâte ni la pression des mains : ne les devine pas.
- Deux cas sont des erreurs, même si chaque geste pris seul ressemble à celui du maître : le résultat se défait d'une image à l'autre au lieu de se former (le pli s'ouvre, le boudin se déroule, la pâte raccourcit) ; ou l'apprenti fait encore le geste d'une autre étape que celle en cours. Réponds alors "correction" avec le geste attendu pour cette étape.
- Sinon, en cas de doute, choisis "en_cours". Une correction fausse fait plus de mal qu'un silence.
- Si l'apprenti est en train d'appliquer une correction déjà donnée, ne la répète pas.
- Dans points_valides, liste les points de contrôle que tu vois respectés dans l'extrait.

Quand c'est indiqué, l'apprenti vient de finir une tentative et te demande de vérifier : il attend une réponse. Avec "en_cours", donne quand même un message de 15 mots maximum : ce qui est déjà bien, puis ce qu'il reste à faire pour finir l'étape.`;

function descriptionEtape(titreLecon: string, etape: Etape, total: number, regles: string[]): string {
  const liste = (titre: string, elements: string[]) =>
    elements.length ? `${titre} :\n${elements.map((e) => `- ${e}`).join("\n")}\n` : "";
  return (
    `Leçon : « ${titreLecon} ». Étape ${etape.numero}/${total} : ${etape.titre}.\n` +
    `Consigne : ${etape.consigne}\n` +
    (etape.explication ? `Détail du geste (validé par le maître) : ${etape.explication}\n` : "") +
    liste("Points de contrôle", etape.pointsDeControle) +
    liste("Erreurs fréquentes", etape.erreursFrequentes) +
    liste("Critères de réussite", etape.criteresDeReussite) +
    liste("Règles du maître (elles corrigent tes erreurs passées : respecte-les avant tout)", regles) +
    "Déroulé de cette étape chez le maître (images successives, de la plus ancienne à la plus récente) :"
  );
}

const CONSIGNE_OBSERVATION =
  "Dans observation, en français, décris d'abord en une ou deux phrases ce que font les mains de l'apprenti d'une image à l'autre " +
  "(sens et ordre du mouvement, forme obtenue), puis compare-le au geste du maître avant de choisir ton verdict.";

const secondes = (t: number) => `${t.toFixed(2).replace(".", ",")} s`;

function presentationApprenti(nombre: number, dureeS: number, demande: boolean): string {
  const ecart = nombre > 1 ? dureeS / (nombre - 1) : 0;
  const images =
    `${nombre} images de l'apprenti, réparties sur ses ${Math.round(dureeS)} dernières secondes ` +
    `(environ une toutes les ${ecart.toFixed(1).replace(".", ",")} s), de la plus ancienne à la plus récente :`;
  return demande ? `L'apprenti vient de finir une tentative et te demande de vérifier. Voici ${images}` : `Voici ${images}`;
}

export async function evaluerGeste(options: {
  titreLecon: string;
  etape: Etape;
  totalEtapes: number;
  imagesMaitre: ImageIA[];
  /** Légendes du maître sur ses images, dans le même ordre ("" = pas de légende). */
  legendesMaitre?: string[];
  imagesApprenti: ImageIA[];
  derniersConseils: string[];
  /** Règles du maître qui s'appliquent à cette étape. */
  regles: string[];
  /** Secondes couvertes par les images de l'apprenti (de la première à la dernière). */
  dureeS: number;
  /** Vrai si l'apprenti a demandé la vérification (il attend une réponse). */
  demande: boolean;
  /**
   * Instant de chaque image de l'apprenti, en secondes depuis la première : chaque image est alors
   * datée pour l'IA (utile quand elles vont par paires rapprochées pour montrer le sens du mouvement).
   */
  instantsS?: number[];
  /** Effort de réflexion de l'IA : "low" par défaut (réponse rapide). */
  effort?: "low" | "medium";
  /** L'IA décrit le mouvement observé avant de juger (champ observation de la réponse). */
  observer?: boolean;
}): Promise<Verdict> {
  const referenceMaitre: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "text", text: descriptionEtape(options.titreLecon, options.etape, options.totalEtapes, options.regles) },
    // Une légende du maître précède l'image qu'elle décrit.
    ...options.imagesMaitre.flatMap((image, i): Anthropic.Beta.BetaContentBlockParam[] => {
      const legende = options.legendesMaitre?.[i]?.trim();
      return legende ? [{ type: "text", text: `Le maître, sur l'image suivante : « ${legende} »` }, blocImage(image)] : [blocImage(image)];
    }),
  ];
  // Tout ce qui précède ce point est identique pendant toute l'étape : on le met en cache.
  const dernier = referenceMaitre[referenceMaitre.length - 1];
  if (dernier.type === "image" || dernier.type === "text") {
    dernier.cache_control = { type: "ephemeral" };
  }

  const conseils = options.derniersConseils.length
    ? `Tes derniers conseils à l'apprenti (du plus ancien au plus récent) :\n${options.derniersConseils.map((c) => `- ${c}`).join("\n")}`
    : "Tu ne lui as encore rien dit pendant cette étape.";

  const reponse = await claude().beta.messages.create(
    {
      model: MODELE,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Effort bas : la réponse doit arriver en quelques secondes, pendant que l'apprenti travaille.
      output_config: {
        effort: options.effort ?? "low",
        format: { type: "json_schema", schema: options.observer ? SCHEMA_VERDICT_OBSERVE : SCHEMA_VERDICT },
      },
      system: SYSTEME_TUTEUR,
      messages: [
        {
          role: "user",
          content: [
            ...referenceMaitre,
            { type: "text", text: conseils },
            { type: "text", text: presentationApprenti(options.imagesApprenti.length, options.dureeS, options.demande) },
            ...options.imagesApprenti.flatMap((image, i): Anthropic.Beta.BetaContentBlockParam[] =>
              options.instantsS?.[i] === undefined
                ? [blocImage(image)]
                : [{ type: "text", text: `t = ${secondes(options.instantsS[i])}` }, blocImage(image)]),
            { type: "text", text: options.observer ? `${CONSIGNE_OBSERVATION}\nTon verdict sur ce que fait l'apprenti ?` : "Ton verdict sur ce que fait l'apprenti ?" },
          ],
        },
      ],
    },
    { timeout: 60_000 },
  );

  const brut = JSON.parse(texteReponse(reponse)) as {
    observation?: string;
    verdict: TypeVerdict;
    message: string;
    points_valides: string[];
  };
  const usage: Consommation = {
    entree: reponse.usage.input_tokens,
    sortie: reponse.usage.output_tokens,
    cacheLecture: reponse.usage.cache_read_input_tokens ?? 0,
    cacheEcriture: reponse.usage.cache_creation_input_tokens ?? 0,
  };
  return {
    verdict: brut.verdict,
    message: brut.message.trim(),
    pointsValides: brut.points_valides,
    usage,
    ...(brut.observation ? { observation: brut.observation.trim() } : {}),
  };
}
