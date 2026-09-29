// Commandes vocales dans le navigateur (téléphone ou tablette posé sur un support) : l'apprenti
// et le maître ont les mains prises, ils parlent au lieu de toucher l'écran.
// Mêmes commandes que sur les lunettes (voir lunettes-mentra/src/controleur.ts).

export function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Commande courte de l'apprenti ; les phrases longues (plus de 4 mots) sont ignorées. */
export function commandeApprenti(texte) {
  const t = normaliser(texte);
  if (!t || t.split(" ").length > 4) return null;
  if (/\b(verifie|verifier|verif|regarde|check)\b|c'est bon/.test(t)) return "verifier";
  if (/\b(explique|expliquer|explication|details|comment)\b/.test(t)) return "expliquer";
  if (/\b(suivant|suivante|next)\b/.test(t)) return "suivant";
  if (/\b(precedent|precedente|retour|back)\b/.test(t)) return "precedent";
  if (/\b(repete|repeter|redis|redire|repeat)\b/.test(t)) return "repeter";
  if (/\b(recommence|recommencer|restart)\b/.test(t)) return "recommencer";
  if (/\b(montre|geste|video|show)\b/.test(t)) return "montrer";
  return null;
}

/** Commandes du maître pendant sa démonstration ; le reste de ce qu'il dit est son explication. */
export function commandeMaitre(texte) {
  const t = normaliser(texte);
  if (!t || t.split(" ").length > 5) return null;
  if (/\b(etape suivante|nouvelle etape|suivant|next step)\b/.test(t)) return "etape";
  if (/\b(termine|terminee|fini|finie|fin de la demo|fin de la demonstration)\b/.test(t)) return "terminer";
  return null;
}

const Reconnaissance = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;

export const reconnaissanceDisponible = () => Boolean(Reconnaissance);

/**
 * Écoute en continu et transmet chaque phrase entendue. Le navigateur coupe l'écoute de temps
 * en temps (silence, réseau) : on la relance tant qu'elle n'a pas été arrêtée.
 */
export class Ecoute {
  constructor({ surPhrase, surEtat = () => {}, langue = "fr-FR" }) {
    this.surPhrase = surPhrase;
    this.surEtat = surEtat;
    this.langue = langue;
    this.active = false;
    this.moteur = null;
  }

  demarrer() {
    if (!Reconnaissance) {
      this.surEtat("indisponible", "Ce navigateur ne reconnaît pas la voix (essaie Chrome ou Safari).");
      return false;
    }
    if (this.active) return true;
    this.active = true;
    this.lancer();
    return true;
  }

  arreter() {
    this.active = false;
    try { this.moteur?.abort(); } catch {}
    this.moteur = null;
    this.surEtat("arretee", "");
  }

  lancer() {
    const moteur = new Reconnaissance();
    moteur.lang = this.langue;
    moteur.continuous = true;
    moteur.interimResults = false;
    moteur.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) this.surPhrase(e.results[i][0].transcript.trim());
      }
    };
    moteur.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.active = false;
        this.surEtat("refusee", "Micro refusé : autorise-le dans le navigateur, ou utilise les boutons.");
      } else if (e.error === "audio-capture") {
        this.active = false;
        this.surEtat("refusee", "Micro indisponible (déjà utilisé ?) : utilise les boutons.");
      }
      // « no-speech », « network », « aborted » : la relance se fait à la fin de l'écoute.
    };
    moteur.onend = () => {
      if (this.moteur === moteur && this.active) setTimeout(() => this.active && this.lancer(), 300);
    };
    this.moteur = moteur;
    try {
      moteur.start();
      this.surEtat("ecoute", "J'écoute.");
    } catch (erreur) {
      this.surEtat("refusee", `Écoute impossible : ${erreur.message}`);
    }
  }
}
