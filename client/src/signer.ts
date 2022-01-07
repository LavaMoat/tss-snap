import { ecrecover, pubToAddress } from "ethereumjs-util";
import { WebSocketClient } from "./websocket";
import { GroupInfo } from "./store/group";
import {
  PartyKey,
  PartySignup,
  SignResult,
  makeOnTransition,
} from "./state-machine";
import { signMessage, SignState, SignTransition } from "./state-machine/sign";

export function getPublicKey(
  signMessage: string,
  signResult: SignResult
): Buffer {
  const msgHash = Buffer.from(signMessage, "hex");
  //console.log("signMessage", signMessage);
  return ecrecover(
    msgHash,
    27 + signResult.recid,
    Buffer.from(signResult.r, "hex"),
    Buffer.from(signResult.s, "hex")
  );
}

export function getPublicAddress(
  signMessage: string,
  signResult: SignResult
): Buffer {
  return pubToAddress(getPublicKey(signMessage, signResult));
}

export function getPublicAddressString(
  signMessage: string,
  signResult: SignResult
): string {
  const address = getPublicAddress(signMessage, signResult);
  return `0x${address.toString("hex")}`;
}

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
