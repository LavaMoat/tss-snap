import React, { useState, useContext, useEffect } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";

import { groupSelector, GroupInfo } from "../store/group";
import { keygenSelector } from "../store/keygen";
import { EcdsaWorker } from "../worker";
import { WorkerContext } from "../worker-provider";
import { WebSocketClient } from "../mpc/clients/websocket";
import { WebSocketContext } from "../websocket-provider";
import { Phase, Session, KeyShare } from "../mpc";
import { sign } from "../mpc/sign";

import { WebSocketStream, WebSocketSink } from "../mpc/transports/websocket";

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
  worker: EcdsaWorker;
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

  // Track if a signing session is in progress
  const [runningSession, setRunningSession] = useState(false);

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

    // Ensure we don't leak listeners when signing multiple times
    websocket.removeAllListeners("sessionMessage");

    // Create the sink as early as possible
    const sink = new WebSocketSink(
      websocket,
      group.params.threshold,
      session.uuid
    );

    websocket.once("sessionSignup", async (sessionId: string) => {
      if (sessionId === session.uuid) {
        if (!runningSession) {
          setRunningSession(true);

          const hash = await worker.sha256(proposal.message);

          const stream = new WebSocketStream(
            websocket,
            group.uuid,
            partySignup.uuid,
            Phase.SIGN
          );

          const { signature: signResult, address: publicAddress } = await sign(
            websocket,
            worker,
            stream,
            sink,
            hash,
            keyShare,
            group,
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

          setRunningSession(false);
        } else {
          console.warn("Signing in progress, cannot start a new session");
        }
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
      <div className="proposal">
        <p>
          Address: <span className="address">{result.publicAddress}</span>
        </p>
        <pre>
          <code>{JSON.stringify(result.signResult, undefined, 2)}</code>
        </pre>
      </div>
    );
  };

  const Setup = () => {
    return (
      <>
        <p>Session ID: {session.uuid}</p>
        <p>Party #: {partyNumber > 0 ? partyNumber : "-"}</p>
        <button
          className="sign-proposal"
          disabled={partyNumber > 0}
          onClick={onSignMessage}
        >
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
                {proposals.map((proposal: Proposal) => {
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
