import { WebSocketClient } from "./websocket";
import { GroupInfo } from "./store/group";
import {
  PartyKey,
  PartySignup,
  SignResult,
  makeOnTransition,
} from "./state-machine";
import { signMessage, SignState, SignTransition } from "./state-machine/sign";
import { getPublicAddressString } from "./public-key";

interface SignResultPublicAddress {
  signResult: SignResult;
  publicAddress: string;
}

export async function sign(
  message: string,
  keyShare: PartyKey,
  group: GroupInfo,
  websocket: WebSocketClient,
  worker: any,
  partySignup: PartySignup
): Promise<SignResultPublicAddress> {
  const onTransition = makeOnTransition<SignState, SignTransition>();

  const sessionInfo = {
    groupId: group.uuid,
    sessionId: partySignup.uuid,
    parameters: group.params,
    partySignup,
  };

  const signResult = await signMessage(
    websocket,
    worker,
    onTransition,
    sessionInfo,
    keyShare,
    message
  );

  const publicAddress = getPublicAddressString(message, signResult);
  return { signResult, publicAddress };
}
