import React, { useState, useContext, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import { groupSelector } from "../store/group";
import { keygenSelector } from "../store/keygen";
import { WorkerContext } from "../worker-provider";
//import { WebSocketClient } from "../mpc/clients/websocket";
import { WebSocketContext } from "../websocket-provider";
import {
  WebSocketClient,
  GroupInfo,
  WebSocketStream,
  WebSocketSink,
  SessionKind,
  KeyShare,
  SignResult,
  EcdsaWorker,
  sign,
} from "@metamask/mpc-client";
//import { sign } from "@metamask/mpc-client";

//import { WebSocketStream, WebSocketSink } from "../mpc/transports/websocket";

import {
  addProposal,
  updateProposal,
  Proposal,
  proposalsSelector,
} from "../store/proposals";

interface ProposalNotification {
  sessionId: string;
  proposalId: string;
  message: string;
}

interface SignedNotification {
  proposal: Proposal;
  signResult: SignResult;
  publicAddress: string;
}

interface ProposalProps {
  address: string;
  group: GroupInfo;
  proposal: Proposal;
  websocket: WebSocketClient;
  worker: EcdsaWorker;
  keyShare: KeyShare;
  onSignComplete: (
    proposal: Proposal,
    signResult: SignResult,
    address: string
  ) => void;
}

const Proposal = ({
  address,
  group,
  proposal,
  websocket,
  worker,
  keyShare,
  onSignComplete,
}: ProposalProps) => {
  const [session, setSession] = useState(proposal.session);
  const [partyNumber, setPartyNumber] = useState(0);

  const { result } = proposal;

  //const [result, setResult] = useState(null);

  // Track if a signing session is in progress
  const [runningSession, setRunningSession] = useState(false);

  useEffect(() => {
    if (proposal.creator) {
      const createProposalSession = async () => {
        const targetSession = await websocket.rpc({
          method: "Session.create",
          params: [group.uuid, SessionKind.SIGN, null],
        });
        const session = await websocket.rpc({
          method: "Session.join",
          params: [group.uuid, targetSession.uuid, SessionKind.SIGN],
        });

        // Send signing proposal notification
        await websocket.notify({
          method: "Notify.proposal",
          params: [group.uuid, session.uuid, proposal.key, proposal.message],
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
      params: [group.uuid, session.uuid, SessionKind.SIGN],
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
        // Keep this to check we don't regress on #49
        if (runningSession) {
          throw new Error(`sign session ${sessionId} is already running`);
        }

        if (!runningSession) {
          setRunningSession(true);

          const hash = await worker.sha256(proposal.message);

          const stream = new WebSocketStream(
            websocket,
            group.uuid,
            partySignup.uuid,
            SessionKind.SIGN
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

          //setResult({ signResult, publicAddress });

          onSignComplete(proposal, signResult, publicAddress);

          if (partySignup.number === 1) {
            await websocket.rpc({
              method: "Notify.signed",
              params: [
                group.uuid,
                session.uuid,
                { proposal, signResult, publicAddress },
              ],
            });
          }

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
  const dispatch = useDispatch();
  const { proposals } = useSelector(proposalsSelector);

  useEffect(() => {
    websocket.on(
      "notifyProposal",
      async (notification: ProposalNotification) => {
        const { sessionId, proposalId, message } = notification;
        const session = await websocket.rpc({
          method: "Session.join",
          params: [group.uuid, sessionId, SessionKind.SIGN],
        });
        const proposal = {
          key: proposalId,
          message,
          creator: false,
          session,
        };
        dispatch(addProposal(proposal));
      }
    );

    websocket.on("notifySigned", (result: SignedNotification) => {
      const { proposal, signResult, publicAddress } = result;
      const signedProposal = {
        ...proposal,
        result: { signResult, publicAddress },
      };
      dispatch(updateProposal(signedProposal));
    });
  }, []);

  const onSignFormSubmit = (message: string) => {
    const proposal = { message, creator: true, key: uuidv4() };
    dispatch(addProposal(proposal));
  };

  const onSignComplete = (
    proposal: Proposal,
    signResult: SignResult,
    publicAddress: string
  ) => {
    const signedProposal = {
      ...proposal,
      result: { signResult, publicAddress },
    };
    dispatch(updateProposal(signedProposal));
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
                      onSignComplete={onSignComplete}
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
