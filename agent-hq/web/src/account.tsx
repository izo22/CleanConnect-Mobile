import { createContext, useContext } from "react";
import type { Me, Role, WorkspaceRef } from "./api.ts";
import { tr } from "./i18n.ts";

const RANK: Record<Role, number> = { viewer: 0, member: 1, owner: 2 };

export interface Account {
  me: Me;
  /** The workspace on screen. */
  ws: WorkspaceRef;
  /** true when the person's role in this workspace is at least `role`. */
  can: (role: Role) => boolean;
  switchTo: (id: string) => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account {
  const a = useContext(AccountContext);
  if (!a) throw new Error("useAccount outside AccountContext");
  return a;
}

/** Hides what a viewer is not allowed to do (the server refuses it anyway). */
export const useCan = () => useAccount().can;

export const canFor = (role: Role) => (needed: Role) => RANK[role] >= RANK[needed];

export const roleLabel = (r: Role) => ({ owner: tr("Owner", "Propriétaire"), member: tr("Member", "Membre"), viewer: tr("Viewer", "Lecteur") })[r];

export const roleHelp = (r: Role) =>
  ({
    owner: tr("Everything, plus inviting and removing people.", "Tout, plus inviter et retirer des personnes."),
    member: tr("Runs the agents: pause, settings, guardrails, connections.", "Pilote les agents : pause, réglages, garde-fous, connexions."),
    viewer: tr("Sees everything, approves or declines decisions, reports mistakes.", "Voit tout, approuve ou refuse les décisions, signale les erreurs."),
  })[r];

export const viewOnlyNote = () => tr("View only: ask an owner of this workspace if you need to act.", "Lecture seule : demandez à un propriétaire de l'espace si vous devez agir.");
