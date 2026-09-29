// Réception d'une vidéo en direct (RTMP), par exemple depuis les lunettes Mentra.
// ffmpeg écoute sur un port, en tire 2 images par seconde pour l'IA et peut enregistrer la vidéo.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { DecoupeurJpeg, FFMPEG, filtreAnalyse } from "./video.ts";

/** Ports réservés au direct, par exemple "1935-1944" (un port par direct en cours). */
function plagePorts(): number[] {
  const [debut, fin] = (process.env.PORTS_RTMP ?? "1935-1944").split("-").map(Number);
  return Array.from({ length: (fin ?? debut) - debut + 1 }, (_, i) => debut + i);
}
const portsOccupes = new Set<number>();

export interface OptionsDirect {
  /** Appelé à chaque image extraite du direct. */
  surImage: (image: Buffer) => void;
  /** Cadence d'extraction des images (défaut : 2 par seconde). */
  imagesParSeconde?: number;
  /** Si défini, la vidéo reçue est aussi enregistrée dans ce dossier (un fichier par connexion). */
  dossierEnregistrement?: string;
}

/**
 * Un point de réception RTMP. ffmpeg n'accepte qu'une connexion à la fois : si les lunettes
 * se déconnectent (réseau), on relance l'écoute tant que le direct n'est pas arrêté.
 */
export class ReceptionDirect {
  readonly port: number;
  readonly cle = randomBytes(8).toString("hex");
  /** Fichiers enregistrés (un par connexion des lunettes). */
  readonly enregistrements: string[] = [];
  private processus: ChildProcessWithoutNullStreams | null = null;
  private actif = true;
  private readonly options: OptionsDirect;

  constructor(options: OptionsDirect) {
    const libre = plagePorts().find((p) => !portsOccupes.has(p));
    if (libre === undefined) throw new Error("Trop de directs en cours : plus de port RTMP libre");
    portsOccupes.add(libre);
    this.port = libre;
    this.options = options;
    this.ecouter();
  }

  /** Adresse à donner aux lunettes. `hote` est le nom public du serveur. */
  url(hote: string): string {
    const base = process.env.URL_RTMP_PUBLIQUE ?? `rtmp://${hote}`;
    return `${base.replace(/\/+$/, "")}:${this.port}/live/${this.cle}`;
  }

  private ecouter(): void {
    const args = [
      "-hide_banner", "-loglevel", "error",
      "-listen", "1", "-i", `rtmp://0.0.0.0:${this.port}/live/${this.cle}`,
      "-map", "0:v:0", "-vf", filtreAnalyse(this.options.imagesParSeconde), "-q:v", "5", "-f", "image2pipe", "-c:v", "mjpeg", "pipe:1",
    ];
    if (this.options.dossierEnregistrement) {
      // Matroska résiste à une coupure brutale (au contraire du MP4).
      const fichier = path.join(this.options.dossierEnregistrement, `direct-${this.enregistrements.length + 1}.mkv`);
      this.enregistrements.push(fichier);
      args.push("-map", "0", "-c", "copy", "-f", "matroska", fichier);
    }
    const decoupeur = new DecoupeurJpeg();
    const processus = spawn(FFMPEG, args);
    this.processus = processus;
    processus.stdout.on("data", (octets: Buffer) => {
      for (const image of decoupeur.ajouter(octets)) this.options.surImage(image);
    });
    processus.stderr.on("data", (m: Buffer) => {
      const message = m.toString().trim();
      // Fin de connexion des lunettes : normal, on se remet à l'écoute.
      if (!/Error during demuxing|Input\/output error/.test(message)) console.warn(`Direct ${this.port} :`, message);
    });
    processus.stdin.on("error", () => undefined);
    processus.on("close", () => {
      if (this.processus === processus) this.processus = null;
      // Les lunettes se sont déconnectées : on se remet à l'écoute.
      if (this.actif) setTimeout(() => this.actif && this.ecouter(), 500);
    });
  }

  /** Arrête le direct et attend que l'enregistrement soit correctement fermé. */
  async arreter(): Promise<void> {
    if (!this.actif) return;
    this.actif = false;
    portsOccupes.delete(this.port);
    const processus = this.processus;
    if (!processus) return;
    await new Promise<void>((fini) => {
      const tuer = setTimeout(() => processus.kill("SIGKILL"), 5000);
      processus.once("close", () => {
        clearTimeout(tuer);
        fini();
      });
      // « q » demande à ffmpeg de terminer proprement ; s'il attend encore une connexion, on l'interrompt.
      processus.stdin.write("q");
      processus.kill("SIGINT");
    });
  }
}
