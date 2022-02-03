import React, { useState, useContext, useEffect } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import WalletConnect from "@walletconnect/client";
import { Transaction } from "@ethereumjs/tx";

import { groupSelector, GroupInfo } from "../store/group";
import { keygenSelector } from "../store/keygen";
import { WorkerContext } from "../worker-provider";
import { WebSocketContext, WebSocketClient } from "../websocket";
import { Phase, Session, KeyShare } from "../state-machine";
import { sign } from "../signer";

interface Proposal {
  key: number;
  message: string;
  creator: boolean;
  session?: Session;
}

interface ProposalNotification {
  sessionId: string;
  message: string;
}

interface ProposalProps {
  address: string;
  group: GroupInfo;
  proposal: Proposal;
  websocket: WebSocketClient;
  worker: any;
  keyShare: KeyShare;
}

const Proposal = ({
  address,
  group,
  proposal,
  websocket,
  worker,
  keyShare,
}: ProposalProps) => {
  const [session, setSession] = useState(proposal.session);
  const [partyNumber, setPartyNumber] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (proposal.creator) {
      const createProposalSession = async () => {
        const targetSession = await websocket.rpc({
          method: "Session.create",
          params: [group.uuid, Phase.SIGN],
        });
        const session = await websocket.rpc({
          method: "Session.join",
          params: [group.uuid, targetSession.uuid, Phase.SIGN],
        });

        // Send signing proposal notification
        websocket.notify({
          method: "Notify.proposal",
          params: [group.uuid, session.uuid, proposal.message],
        });

        setSession(session);
      };
      createProposalSession();
    }
  }, []);

  const onSignMessage = async (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const number = await websocket.rpc({
      method: "Session.signup",
      params: [group.uuid, session.uuid, Phase.SIGN],
    });
    const partySignup = { number, uuid: session.uuid };
    const newSession = {
      ...session,
      partySignup,
    };
    setPartyNumber(number);
    setSession(newSession);

    websocket.once("sessionSignup", async (sessionId: string) => {
      if (sessionId === session.uuid) {
        const hash = await worker.sha256(proposal.message);

        const { signature: signResult, address: publicAddress } = await sign(
          hash,
          keyShare,
          group,
          websocket,
          worker,
          partySignup
        );

        if (address !== publicAddress) {
          throw new Error(
            `signed message has different public address, expected ${address} got ${publicAddress} using ${JSON.stringify(
              signResult
            )}`
          );
        }

        setResult({ signResult, publicAddress });
      } else {
        console.warn(
          "Sign got sessionSignup event for wrong session",
          sessionId,
          session.uuid
        );
      }
    });
  };

  if (!session) {
    return null;
  }

  const Result = () => {
    return (
      <>
        <p>Address: {result.publicAddress}</p>
        <pre>
          <code>{JSON.stringify(result.signResult, undefined, 2)}</code>
        </pre>
      </>
    );
  };

  const Setup = () => {
    return (
      <>
        <p>Session ID: {session.uuid}</p>
        <p>Party #: {partyNumber > 0 ? partyNumber : "-"}</p>
        <button disabled={partyNumber > 0} onClick={onSignMessage}>
          Sign
        </button>
      </>
    );
  };

  return (
    <div className="proposal">
      <p>{proposal.message}</p>
      {result ? <Result /> : <Setup />}
    </div>
  );
};

interface FormProps {
  onSubmit: (message: string) => void;
}

const SignForm = (props: FormProps) => {
  const [message, setMessage] = useState("");

  const onSignFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (message.trim() === "") {
      return alert("Please enter a message to sign");
    }
    setMessage("");
    props.onSubmit(message);
  };

  const onMessageChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setMessage(event.currentTarget.value);
  };

  return (
    <>
      <form onSubmit={onSignFormSubmit}>
        <textarea
          placeholder="Enter a message to sign"
          rows={4}
          name="message"
          onChange={onMessageChange}
          value={message}
        ></textarea>
        <input type="submit" name="Sign" value="Submit Proposal" />
      </form>
    </>
  );
};

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
  const websocket = useContext(WebSocketContext);
  const { group } = useSelector(groupSelector);
  const { keyShare } = useSelector(keygenSelector);
  const params = useParams();
  const { address } = params;
  const [proposals, setProposals] = useState([]);

  useEffect(() => {
    websocket.on(
      "notifyProposal",
      async (notification: ProposalNotification) => {
        const { sessionId, message } = notification;
        const session = await websocket.rpc({
          method: "Session.join",
          params: [group.uuid, sessionId, Phase.SIGN],
        });
        const proposal = {
          message,
          creator: false,
          session,
          key: Math.random(),
        };
        const newProposals = [proposal, ...proposals];
        setProposals(newProposals);
      }
    );
  }, []);

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

  //<h4>Connect Wallet</h4>
  //<WalletConnectForm onSubmit={onWalletConnectFormSubmit} />
  /*

        {proposals.length > 0 ? (
          proposals.map((proposal: Proposal, index: number) => {
            return (
              <Proposal
                key={index}
                address={address}
                group={group}
                proposal={proposal}
                websocket={websocket}
              />
            );
          })
        ) : (
          <p>No proposals yet</p>
        )}
  */

  const onSignFormSubmit = (message: string) => {
    const newProposals = [
      { message, creator: true, key: Math.random() },
      ...proposals,
    ];
    setProposals(newProposals);
  };

  return (
    <>
      <h2>Sign in {group.label}</h2>
      <h3 className="address">{address}</h3>
      <hr />
      <h4>Create proposal</h4>
      <SignForm onSubmit={onSignFormSubmit} />
      <hr />
      <h4>Proposals</h4>
      <WorkerContext.Consumer>
        {(worker) => {
          if (proposals.length > 0) {
            return (
              <div>
                {proposals.map((proposal: Proposal, index: number) => {
                  return (
                    <Proposal
                      key={proposal.key}
                      address={address}
                      group={group}
                      proposal={proposal}
                      websocket={websocket}
                      worker={worker}
                      keyShare={keyShare}
                    />
                  );
                })}
              </div>
            );
          } else {
            return <p>No proposals yet</p>;
          }
        }}
      </WorkerContext.Consumer>
    </>
  );
};

export default Sign;
