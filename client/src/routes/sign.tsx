import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import WalletConnect from "@walletconnect/client";
import { Transaction } from "@ethereumjs/tx";

import { groupSelector } from "../store/group";
import { WorkerContext } from "../worker-provider";

interface FormProps {
  onSubmit: (message: string) => void;
}

const WalletConnectForm = (props: FormProps) => {
  const [uri, setUri] = useState("");

  const onWalletConnectFormSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (uri.trim() === "") {
      return alert("Please enter a wallet connect URL");
    }

    props.onSubmit(uri);
  };

  const onMessageChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setUri(event.currentTarget.value);
  };

  return (
    <>
      <form onSubmit={onWalletConnectFormSubmit}>
        <textarea
          placeholder="Enter a walletconnect uri (eg: 'wc:8a5e5bdc-a0e4-47...TJRNmhWJmoxdFo6UDk2WlhaOyQ5N0U=')"
          rows={4}
          name="message"
          onChange={onMessageChange}
          value={uri}
        ></textarea>
        <input type="submit" name="Sign" value="Connect" />
      </form>
    </>
  );
};

const Sign = () => {
  const { group } = useSelector(groupSelector);
  const params = useParams();
  const { address } = params;

  const onWalletConnectFormSubmit = (uri: string) => {
    const connector = new WalletConnect({
      uri,
      bridge: "https://bridge.walletconnect.org",
      clientMeta: {
        description: "WalletConnect Developer App",
        url: "https://walletconnect.org",
        icons: ["https://walletconnect.org/walletconnect-logo.png"],
        name: "WalletConnect",
      },
    });

    connector.on("session_request", (error: Error, payload: object) => {
      if (error) {
        throw error;
      }
      console.log("session_request", payload);
      //setWcConnected(true);

      // Approve Session
      connector.approveSession({
        accounts: [address],
        chainId: 1,
      });
    });

    // Subscribe to call requests
    connector.on("call_request", async (error, payload) => {
      if (error) {
        throw error;
      }
      console.log("call_request", payload);

      // Handle Call Request

      /* payload:
      {
        id: 1,
        jsonrpc: '2.0'.
        method: 'eth_sign',
        params: [
          "0xbc28ea04101f03ea7a94c1379bc3ab32e65e62d3",
          "My email is john@doe.com - 1537836206101"
        ]
      }
      id: 1639703933151242
      jsonrpc: "2.0"
      method: "eth_sendTransaction"
      params: Array(1)
        data: "0x"
        from: "0xf1703c935c8d5fc95b8e3c7686fc87369351c3d1"
        gas: "0x5208"
        gasPrice: "0x11ed8ec200"
        nonce: "0x5d"
        to: "0xf1703c935c8d5fc95b8e3c7686fc87369351c3d1"
        value: "0x0"
      */
      const [txParams] = payload.params;
      const tx = Transaction.fromTxData(txParams);
      console.log("tx", tx);
      const hash = tx.getMessageToSign();
      const hashString = hash.toString("hex");

      /*
      onSignFormSubmit(hashString);
      const [{ signResult }] = (await once(
        workerEvents,
        "sign_result"
      )) as any;
      console.log("got WC sign result", signResult);
      */

      /*
      const signedTx = Transaction.fromTxData({
        ...txParams,
        r: Buffer.from(signResult.r, "hex"),
        s: Buffer.from(signResult.s, "hex"),
        v: 27 + signResult.recid,
      });
      const txHash = signedTx.hash();
      // Approve Call Request
      connector.approveRequest({
        id: payload.id,
        result: `0x${txHash.toString("hex")}`,
      });
      */
    });
  };

  return (
    <>
      <h2>Sign</h2>
      <h3>{address}</h3>
      <hr />
      <h4>Connect Wallet</h4>
      <WalletConnectForm onSubmit={onWalletConnectFormSubmit} />
    </>
  );
};

export default Sign;
