import { ecrecover, pubToAddress } from "ethereumjs-util";
import { SignResult } from "./state-machine";

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
