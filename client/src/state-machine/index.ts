import { Parameters, PartySignup } from "../machine-common";

export interface SessionInfo {
  groupId: string;
  sessionId: string;
  parameters: Parameters;
  partySignup: PartySignup;
}
