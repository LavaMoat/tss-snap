import React, { Component, useState, useEffect, useContext } from "react";
import { useSelector, useDispatch, connect } from "react-redux";
import { groupSelector, GroupInfo, setGroup } from "../store/group";
import { keygenSelector, setKeygenSession, setKeyShare } from "../store/keygen";
import { useParams, useNavigate, NavigateFunction } from "react-router-dom";
import { WebSocketContext } from "../websocket";
import { AppDispatch, RootState } from "../store";

import { WorkerContext } from "../worker-provider";

import { PartyKey, Session, Phase, makeOnTransition } from "../state-machine";
import {
  generateKeyShare,
  KeygenState,
  KeygenTransition,
} from "../state-machine/keygen";

import { signMessage, SignState, SignTransition } from "../state-machine/sign";

import { sign } from "../signer";

const copyToClipboard = async (
  e: React.MouseEvent<HTMLElement>,
  text: string
) => {
  e.preventDefault();
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.error("Permission to write to clipboard was denied");
  }
};

interface KeygenProps {
  group: GroupInfo;
  dispatch: AppDispatch;
  worker: any;
  keyShare?: PartyKey;
  navigate: NavigateFunction;
}

interface KeygenStateProps {
  session: Session;
  targetSession: string;
}

class Keygen extends Component<KeygenProps, KeygenStateProps> {
  static contextType = WebSocketContext;

  constructor(props: KeygenProps) {
    super(props);
    this.state = { session: null, targetSession: "" };
  }

  componentDidMount() {
    const websocket = this.context;
    websocket.on("sessionCreate", (session: Session) => {
      this.setState({ ...this.state, session });
    });

    websocket.on("notifyAddress", (address: string) => {
      console.log("Got public address notification", address);

      this.props.navigate(`/sign/${address}`);
    });

    // All parties signed up to key generation
    websocket.on("sessionSignup", async (sessionId: string) => {
      if (sessionId === this.state.session.uuid) {
        const onTransition = makeOnTransition<KeygenState, KeygenTransition>();

        // Generate a key share
        const { group, worker } = this.props;
        const { partySignup, uuid: sessionId } = this.state.session;

        const sessionInfo = {
          groupId: group.uuid,
          sessionId,
          parameters: group.params,
          partySignup,
        };

        const keyShare = await generateKeyShare(
          websocket,
          worker,
          onTransition,
          sessionInfo
        );

        this.props.dispatch(setKeyShare(keyShare));

        // Finish the session, we will be notified
        // when all clients have finished
        websocket.notify({
          method: "Session.finish",
          params: [group.uuid, sessionId, Phase.KEYGEN],
        });
      } else {
        console.warn(
          "Keygen got sessionSignup event for wrong session",
          sessionId,
          this.state.session.uuid
        );
      }
    });

    websocket.on("sessionFinish", async (sessionId: string) => {
      if (sessionId === this.state.session.uuid) {
        const { group, worker, keyShare } = this.props;
        const { partySignup, uuid: sessionId } = this.state.session;
        const isAutomaticSigner =
          partySignup.number <= group.params.threshold + 1;

        if (isAutomaticSigner) {
          // Automatically sign message and extract public key / address
          //
          // Sha256 of "hello world"
          const message =
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

          const { signResult, publicAddress } = await sign(
            message,
            keyShare,
            group,
            websocket,
            worker,
            partySignup
          );

          console.log("Got sign public address", publicAddress);

          // Announce public address to all parties in the group
          if (partySignup.number === 1) {
            websocket.notify({
              method: "Notify.address",
              params: [group.uuid, publicAddress],
            });
          }
        }
      } else {
        console.warn(
          "Keygen got sessionFinish event for wrong session",
          sessionId,
          this.state.session.uuid
        );
      }
    });
  }

  componentWillUnmount() {
    const websocket = this.context;
    websocket.removeAllListeners("sessionCreate");
    websocket.removeAllListeners("sessionSignup");
    websocket.removeAllListeners("sessionFinish");
    websocket.removeAllListeners("notifyAddress");
  }

  render() {
    const websocket = this.context;
    const { session, targetSession } = this.state;

    const onTargetSessionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      this.setState({ ...this.state, targetSession: e.currentTarget.value });
    };

    const createKeygenSession = async (
      e: React.MouseEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();

      const session = await websocket.rpc({
        method: "Session.create",
        params: [this.props.group.uuid, Phase.KEYGEN],
      });

      this.props.dispatch(setKeygenSession(session));
      this.setState({ ...this.state, session });
    };

    const joinSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const session = await websocket.rpc({
        method: "Session.join",
        params: [this.props.group.uuid, targetSession, Phase.KEYGEN],
      });
      this.props.dispatch(setKeygenSession(session));
      this.setState({ ...this.state, session });
    };

    const signupToSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const partyNumber = await websocket.rpc({
        method: "Session.signup",
        params: [this.props.group.uuid, this.state.session.uuid, Phase.KEYGEN],
      });
      const newSession = {
        ...session,
        partySignup: { number: partyNumber, uuid: session.uuid },
      };
      this.props.dispatch(setKeygenSession(newSession));
      this.setState({ ...this.state, session: newSession });
    };

    const CreateOrJoinSession = () => {
      return (
        <>
          <button onClick={createKeygenSession}>
            Create a key generation session
          </button>
          <p>Or join an existing key generation session:</p>
          <input
            type="text"
            value={targetSession}
            onChange={onTargetSessionChange}
          />
          <button onClick={joinSession}>Join Session</button>
        </>
      );
    };

    const KeygenSessionActions = () => {
      return (
        <>
          <p>
            Key generation session is active do you wish to signup for key
            generation?
          </p>
          <button onClick={signupToSession}>Keygen Signup</button>
        </>
      );
    };

    const KeygenSession = () => {
      return (
        <>
          <p>
            Session ID: {session.uuid} (
            <a href="#" onClick={(e) => copyToClipboard(e, session.uuid)}>
              copy to clipboard
            </a>
            )
          </p>
          {session.partySignup ? (
            <p>Party #: {session.partySignup.number}</p>
          ) : (
            <KeygenSessionActions />
          )}
        </>
      );
    };

    return (
      <>
        <h4>Create key</h4>
        {session ? <KeygenSession /> : <CreateOrJoinSession />}
      </>
    );
  }
}

const ConnectedKeygen = connect((state: RootState) => {
  return { keyShare: state.keygen.keyShare };
})(Keygen);

export default () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { group } = useSelector(groupSelector);
  const params = useParams();
  const { uuid } = params;
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    const joinGroup = async () => {
      const group = await websocket.rpc({
        method: "Group.join",
        params: uuid,
      });
      dispatch(setGroup(group));
    };

    if (!group) {
      joinGroup();
    }
  }, []);

  if (!group) {
    return null;
  }

  return (
    <>
      <h2>Keygen in {group.label}</h2>
      <p>Parties: {group.params.parties}</p>
      <p>Threshold: {group.params.threshold}</p>
      <hr />
      <p>
        To create more connected parties open{" "}
        <a href={location.href}>this link</a> in another window/tab or &nbsp;
        <a href="#" onClick={(e) => copyToClipboard(e, location.href)}>
          copy it to your clipboard
        </a>
        .
      </p>
      <hr />
      <WorkerContext.Consumer>
        {(worker) => {
          return (
            <ConnectedKeygen
              group={group}
              worker={worker}
              navigate={navigate}
            />
          );
        }}
      </WorkerContext.Consumer>
    </>
  );
};
