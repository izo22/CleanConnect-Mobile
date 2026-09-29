// Contrôle de l'installation, une seule fois au démarrage de la caméra : lumière, netteté,
// stabilité du téléphone. Ensuite plus rien : personne n'a à surveiller le cadre en travaillant.
// Les seuils sont des points de départ, à régler sur le terrain.

export const SEUILS = {
  /** Luminosité moyenne (0 à 255) en dessous de laquelle l'image est trop sombre. */
  sombre: 55,
  /** Luminosité moyenne au-dessus de laquelle l'image est surexposée. */
  clair: 215,
  /** Part des pixels presque blancs au-delà de laquelle on soupçonne un contre-jour (fenêtre). */
  contreJour: 0.2,
  /** Netteté (variance du laplacien sur une image 160×90) en dessous de laquelle l'image est floue. */
  flou: 40,
  /** Part des pixels qui changent entre deux images au-delà de laquelle c'est le téléphone qui bouge. */
  bouge: 0.5,
};

const LARGEUR = 160;
const HAUTEUR = 90;

/** Niveaux de gris (un octet par pixel) à partir de pixels RGBA. */
export function niveauxDeGris(rgba) {
  const gris = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < gris.length; i++) {
    gris[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return gris;
}

export function luminosite(gris) {
  let somme = 0;
  for (const v of gris) somme += v;
  return gris.length ? somme / gris.length : 0;
}

export function partSaturee(gris) {
  let n = 0;
  for (const v of gris) if (v >= 245) n++;
  return gris.length ? n / gris.length : 0;
}

/** Variance du laplacien : forte quand l'image a des bords nets, faible quand elle est floue. */
export function nettete(gris, largeur, hauteur) {
  const valeurs = [];
  for (let y = 1; y < hauteur - 1; y++) {
    for (let x = 1; x < largeur - 1; x++) {
      const i = y * largeur + x;
      valeurs.push(4 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - largeur] - gris[i + largeur]);
    }
  }
  if (valeurs.length === 0) return 0;
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
  return valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / valeurs.length;
}

/** Part des pixels qui changent nettement entre deux images. */
export function partQuiBouge(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 25) n++;
  return a.length ? n / a.length : 0;
}

const mediane = (valeurs) => {
  const tries = [...valeurs].sort((a, b) => a - b);
  return tries[Math.floor(tries.length / 2)] ?? 0;
};

/**
 * Juge l'installation à partir de quelques images en niveaux de gris prises à la suite.
 * Renvoie un point par critère, avec un conseil concret quand ça ne va pas.
 */
export function evaluerInstallation(images) {
  const lum = mediane(images.map((i) => luminosite(i.gris)));
  const sature = mediane(images.map((i) => partSaturee(i.gris)));
  const net = mediane(images.map((i) => nettete(i.gris, i.largeur, i.hauteur)));
  let bouge = 0;
  for (let k = 1; k < images.length; k++) bouge = Math.max(bouge, partQuiBouge(images[k - 1].gris, images[k].gris));

  const noire = images.every((i) => i.gris.every((v) => v < 3));
  const lumiere = noire
    ? "Image toute noire : l'objectif est-il masqué ?"
    : lum < SEUILS.sombre
      ? "Trop sombre : allume une lumière au-dessus du plan de travail."
      : lum > SEUILS.clair
        ? "Image trop claire : évite le soleil direct sur le plan de travail."
        : sature > SEUILS.contreJour
          ? "Une zone très claire dans l'image (fenêtre ?) : évite le contre-jour."
          : null;
  const flou = !noire && net < SEUILS.flou ? "Image floue : nettoie l'objectif (farine ?) ou éloigne un peu le téléphone." : null;
  const stable = bouge > SEUILS.bouge ? "Le téléphone bouge : serre bien le support." : null;
  const points = [
    { nom: "Lumière", ok: !lumiere, message: lumiere ?? "Bonne lumière." },
    { nom: "Netteté", ok: !flou, message: flou ?? "Image nette." },
    { nom: "Stabilité", ok: !stable, message: stable ?? "Téléphone stable." },
  ];
  return { ok: points.every((p) => p.ok), points, mesures: { luminosite: lum, nettete: net, bouge, sature } };
}

/** Prend `nombre` images de la caméra (en 160×90) sur `dureeMs`, puis juge l'installation. */
export async function controlerCamera(video, { nombre = 6, dureeMs = 2500 } = {}) {
  const toile = document.createElement("canvas");
  toile.width = LARGEUR;
  toile.height = HAUTEUR;
  const contexte = toile.getContext("2d", { willReadFrequently: true });
  // On attend la première image, puis on laisse la caméra régler son exposition.
  if (video.readyState < 2) {
    await new Promise((ok) => {
      video.addEventListener("loadeddata", ok, { once: true });
      setTimeout(ok, 5000);
    });
  }
  if (!video.videoWidth) throw new Error("la caméra n'envoie pas encore d'image");
  // Une vidéo en pause (lecture automatique bloquée) ne donnerait que des images noires.
  if (video.paused) await video.play().catch(() => undefined);
  await new Promise((ok) => setTimeout(ok, 800));
  const images = [];
  for (let k = 0; k < nombre; k++) {
    contexte.drawImage(video, 0, 0, LARGEUR, HAUTEUR);
    images.push({ gris: niveauxDeGris(contexte.getImageData(0, 0, LARGEUR, HAUTEUR).data), largeur: LARGEUR, hauteur: HAUTEUR });
    await new Promise((ok) => setTimeout(ok, dureeMs / nombre));
  }
  return evaluerInstallation(images);
}

/** Affiche le résultat : ✓ ou ⚠ par critère. */
export function afficherControle(conteneur, resultat, el) {
  conteneur.replaceChildren(
    el("p", { classe: resultat.ok ? "controle-ok" : "controle-alerte" },
      resultat.ok ? "Installation vérifiée : tout est bon, tu peux travailler sans t'en soucier." : "À corriger avant de commencer :"),
    el("ul", { classe: "controle" }, ...resultat.points.map((p) =>
      el("li", { classe: p.ok ? "ok" : "alerte" }, `${p.ok ? "✓" : "⚠"} ${p.nom} : ${p.message}`))),
  );
}
