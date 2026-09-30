// Alertes instantanées, sans IA : à partir de la position des deux mains (suivies sur le téléphone),
// on repère en direct une erreur de mouvement simple et on prévient tout de suite l'apprenti.
// Exemple : pour allonger une baguette, les mains doivent s'écarter ; si elles se rapprochent en
// roulant, c'est l'erreur « partir des extrémités ».

/** Mouvements des mains qu'une étape peut exiger, et le conseil dit quand c'est l'inverse. */
export const MOUVEMENTS = {
  s_ecartent: { attendu: +1, conseil: "Pars du centre et écarte les mains vers les bouts." },
  se_rapprochent: { attendu: -1, conseil: "Rapproche les mains vers le centre." },
};

export const PARAMETRES = {
  /** Durée observée avant de juger (secondes), quand le téléphone suit les mains assez vite. */
  fenetreS: 1.2,
  /**
   * Téléphone lent (peu de mesures par seconde) : on observe au moins ce nombre de mesures,
   * jusqu'à fenetreMaxS secondes, plutôt que de ne jamais pouvoir juger.
   */
  mesuresMin: 5,
  fenetreMaxS: 4,
  /** Variation d'écart entre les mains qui déclenche l'alerte (fraction de la largeur de l'image). */
  variationMin: 0.08,
  /** Les deux mains doivent être vues sur au moins cette part de la fenêtre. */
  presenceMin: 0.75,
  /** Part des pas qui doivent aller dans le mauvais sens (mouvement régulier, pas un tremblement). */
  regulariteMin: 0.65,
  /**
   * Au-delà de cette vitesse (largeur d'image par seconde), c'est un déplacement rapide des mains
   * en l'air (se replacer au centre pour recommencer), pas un geste de travail : pas d'alerte.
   */
  vitesseMax: 0.5,
  /** Pas deux alertes à moins de ce délai (secondes). */
  pauseS: 6,
};

/** Centre de la paume : moyenne du poignet et des bases des doigts (repères MediaPipe 0, 5, 9, 13, 17). */
export function centrePaume(reperes) {
  const points = [0, 5, 9, 13, 17].map((i) => reperes[i]);
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
}

/** Écart entre deux mains, ou null s'il n'y en a pas deux. */
export function ecartMains(mains) {
  if (mains.length < 2) return null;
  const [a, b] = mains;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Surveille l'écart entre les mains et renvoie un conseil dès que le mouvement va dans le
 * mauvais sens de façon régulière pendant un peu plus d'une seconde.
 */
export class SurveillantMouvement {
  constructor(mouvement, parametres = PARAMETRES) {
    this.regle = MOUVEMENTS[mouvement];
    if (!this.regle) throw new Error(`Mouvement inconnu : ${mouvement}`);
    this.p = parametres;
    this.mesures = [];
    this.derniereAlerte = -Infinity;
    this.dernierT = null;
    this.intervalle = 1 / 15;
  }

  /** Durée observée : plus longue si le téléphone mesure lentement. */
  get fenetre() {
    return Math.min(this.p.fenetreMaxS, Math.max(this.p.fenetreS, this.p.mesuresMin * this.intervalle));
  }

  /** Ajoute une mesure (t en secondes, mains = centres des paumes). Renvoie le conseil à dire, ou null. */
  ajouter(t, mains) {
    const p = this.p;
    // Intervalle moyen entre deux mesures (lissé), pour adapter la fenêtre à la vitesse du téléphone.
    if (this.dernierT !== null && t > this.dernierT) this.intervalle = 0.8 * this.intervalle + 0.2 * (t - this.dernierT);
    this.dernierT = t;
    const fenetre = this.fenetre;
    this.mesures.push({ t, ecart: ecartMains(mains) });
    while (this.mesures.length && this.mesures[0].t < t - fenetre) this.mesures.shift();
    if (t - this.derniereAlerte < p.pauseS) return null;
    const duree = t - this.mesures[0].t;
    if (duree < fenetre * 0.8) return null;
    const vues = this.mesures.filter((m) => m.ecart !== null);
    if (vues.length < 3 || vues.length / this.mesures.length < p.presenceMin) return null;

    // Variation d'écart dans le sens contraire de celui attendu.
    const variation = (vues[vues.length - 1].ecart - vues[0].ecart) * -this.regle.attendu;
    let pasContraires = 0;
    for (let i = 1; i < vues.length; i++) {
      if ((vues[i].ecart - vues[i - 1].ecart) * -this.regle.attendu > 0) pasContraires++;
    }
    const regularite = pasContraires / (vues.length - 1);
    const vitesse = variation / Math.max(0.001, vues[vues.length - 1].t - vues[0].t);
    if (variation >= p.variationMin && regularite >= p.regulariteMin && vitesse <= p.vitesseMax) {
      this.derniereAlerte = t;
      this.mesures = [];
      return this.regle.conseil;
    }
    return null;
  }
}
