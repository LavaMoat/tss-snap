import { WebSocketClient } from "./websocket";
import { GroupInfo } from "./store/group";
import {
  KeyShare,
  PartySignup,
  SignResult,
  makeOnTransition,
  SignMessage,
} from "./state-machine";
import { signMessage, SignState, SignTransition } from "./state-machine/sign";

export async function sign(
  message: string,
  keyShare: KeyShare,
  group: GroupInfo,
  websocket: WebSocketClient,
  worker: any,
  partySignup: PartySignup
): Promise<SignMessage> {
  const onTransition = makeOnTransition<SignState, SignTransition>();

  const sessionInfo = {
    groupId: group.uuid,
    sessionId: partySignup.uuid,
    parameters: group.params,
    partySignup,
  };

  const signedMessage = await signMessage(
    websocket,
    worker,
    onTransition,
    sessionInfo,
    keyShare,
    message
  );

  return signedMessage;
}
