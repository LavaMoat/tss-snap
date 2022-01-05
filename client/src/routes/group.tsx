import React, { Component, useState, useEffect, useContext } from "react";
import { useSelector, useDispatch, connect } from "react-redux";
import { groupSelector, GroupInfo } from "../store/group";
import { keygenSelector, setKeygenSession, setKeyShare } from "../store/keygen";
import { useParams } from "react-router-dom";
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
import { getPublicAddressString } from "../public-key";

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
    websocket.on("session_create", (session: Session) => {
      this.setState({ ...this.state, session });
    });

    // All parties signed up to key generation
    websocket.on("session_signup", async (sessionId: string) => {
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
          method: "session_finish",
          params: [group.uuid, sessionId, Phase.KEYGEN],
        });
      } else {
        console.warn(
          "Keygen got session_ready event for wrong session",
          sessionId,
          this.state.session.uuid
        );
      }
    });

    websocket.on("session_finish", async (sessionId: string) => {
      if (sessionId === this.state.session.uuid) {
        const { group, worker, keyShare } = this.props;
        const { partySignup, uuid: sessionId } = this.state.session;
        const isAutomaticSigner =
          this.state.session.partySignup.number <= group.params.threshold + 1;

        if (isAutomaticSigner) {
          // Automatically sign message and extract public key / address

          // sha256 of "hello world"
          const message =
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

          const onTransition = makeOnTransition<SignState, SignTransition>();

          const sessionInfo = {
            groupId: group.uuid,
            sessionId,
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
          console.log("Got sign public address", publicAddress);

          // TODO: announce public address to all parties
        }
      } else {
        console.warn(
          "Keygen got session_finish event for wrong session",
          sessionId,
          this.state.session.uuid
        );
      }
    });
  }

  componentWillUnmount() {
    const websocket = this.context;
    websocket.removeAllListeners("session_create");
    websocket.removeAllListeners("session_signup");
    websocket.removeAllListeners("session_finish");
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
        method: "session_create",
        params: [this.props.group.uuid, Phase.KEYGEN],
      });

      this.props.dispatch(setKeygenSession(session));
      this.setState({ ...this.state, session });
    };

    const joinSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const session = await websocket.rpc({
        method: "session_join",
        params: [this.props.group.uuid, targetSession, Phase.KEYGEN],
      });
      this.props.dispatch(setKeygenSession(session));
      this.setState({ ...this.state, session });
    };

    const signupToSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const partyNumber = await websocket.rpc({
        method: "session_signup",
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
          <button onClick={(e) => copyToClipboard(e, session.uuid)}>
            Copy Session ID to Clipboard
          </button>
        </>
      );
    };

    const KeygenSession = () => {
      return (
        <>
          <p>Session ID: {session.uuid}</p>
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
        <h3>Key generation</h3>
        {session ? <KeygenSession /> : <CreateOrJoinSession />}
      </>
    );
  }
}

const ConnectedKeygen = connect((state: RootState) => {
  return { keyShare: state.keygen.keyShare };
})(Keygen);

interface GroupProps {}

export default (props: GroupProps) => {
  const [group, setGroup] = useState(null);
  const dispatch = useDispatch();
  const { group: savedGroup } = useSelector(groupSelector);
  const params = useParams();
  const { uuid } = params;
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    const joinGroup = async () => {
      const group = await websocket.rpc({
        method: "group_join",
        params: [uuid],
      });
      setGroup(group);
    };

    // Group creator already has the group info
    if (savedGroup) {
      setGroup(savedGroup);
      // Otherwise try to join the group
    } else {
      joinGroup();
    }
  }, [savedGroup]);

  if (group) {
    return (
      <>
        <h3>{group.label}</h3>
        <p>Parties: {group.params.parties}</p>
        <p>Threshold: {group.params.threshold}</p>
        <p>
          Join <a href={location.href}>this group</a> in another window/tab or
          open this link on another device:
        </p>
        <pre>{location.href}</pre>
        <p>
          <button onClick={(e) => copyToClipboard(e, location.href)}>
            Copy to clipboard
          </button>
        </p>
        <hr />
        <WorkerContext.Consumer>
          {(worker) => {
            return <ConnectedKeygen group={group} worker={worker} />;
          }}
        </WorkerContext.Consumer>
      </>
    );
  } else {
    return null;
  }
};
