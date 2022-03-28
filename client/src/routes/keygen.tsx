import React, { Component, useEffect, useContext } from "react";
import { useSelector, useDispatch, connect } from "react-redux";
import { groupSelector, GroupInfo, setGroup } from "../store/group";
import { setKeygenSession, setKeyShare } from "../store/keygen";
import { useParams, useNavigate, NavigateFunction } from "react-router-dom";
import { WebSocketContext } from "../websocket-provider";
import { AppDispatch, RootState } from "../store";

import { EcdsaWorker } from "../worker";
import { WorkerContext } from "../worker-provider";
import {
  saveKeyShare,
  loadKeysForParties,
  findKeyValue,
  KeyStorage,
} from "../key-storage";

import { KeyShare, Session, SessionKind } from "../mpc";
import { generateKeyShare } from "../mpc/keygen";

import { WebSocketStream, WebSocketSink } from "../mpc/transports/websocket";

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
  worker: EcdsaWorker;
  keyShare?: KeyShare;
  navigate: NavigateFunction;
}

interface KeygenStateProps {
  session?: Session;
  sink?: WebSocketSink;
  runningSession?: string;
  targetSession: string;
  savedKeys: KeyStorage;
  loadedKeyShare?: [string, number, number];
}

// This needs to be a class-based component as we need to
// remove listeners when the component is un-mounted.
class Keygen extends Component<KeygenProps, KeygenStateProps> {
  static contextType = WebSocketContext;

  constructor(props: KeygenProps) {
    super(props);
    const savedKeys = loadKeysForParties(props.group.params.parties);
    this.state = {
      session: null,
      targetSession: "",
      loadedKeyShare: null,
      savedKeys,
    };
  }

  // Hack for a race condition whereby party signup is being
  // set *after* session has been started. Requires further
  // investigation.
  async waitForPartySignup() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const { partySignup } = this.state.session;
        if (partySignup) {
          clearInterval(interval);
          resolve(partySignup);
        }
      }, 250);
    });
  }

  componentDidMount() {
    const websocket = this.context;

    websocket.on("sessionCreate", (session: Session) => {
      this.setState({ ...this.state, session });
    });

    websocket.on("sessionClosed", () => {
      const { partySignup } = this.state.session;
      const { address } = this.props.keyShare;

      saveKeyShare(
        address,
        partySignup.number,
        this.props.group.params.parties,
        this.props.keyShare
      );
      console.log(
        "Saved key share for public address",
        address,
        " and party number",
        partySignup.number,
        " keyShare is ",
        this.props.keyShare
      );
      this.props.navigate(`/sign/${address}`);
    });

    // All parties signed up to key generation
    websocket.on("sessionSignup", async (sessionId: string) => {
      if (sessionId === this.state.session.uuid) {
        const { runningSession } = this.state;

        if (runningSession) {
          throw new Error(
            "SESSION IS ALREADY RUNNING, GOT DUPLICATE SESSION SIGNUP"
          );
        }

        // Guard against running multiple key generation sessions
        if (!runningSession) {
          this.setState({
            ...this.state,
            runningSession: this.state.session.uuid,
          });

          // Crude hack to wait for `partySignup` as there
          // is a race condition where this event can fire
          // before the `partySignup` has been assigned.
          await this.waitForPartySignup();

          // Generate a key share
          const { group, worker } = this.props;
          const { partySignup, uuid: sessionId } = this.state.session;

          const sessionInfo = {
            groupId: group.uuid,
            sessionId,
            parameters: group.params,
            partySignup,
          };

          const stream = new WebSocketStream(
            websocket,
            sessionInfo.groupId,
            sessionInfo.sessionId,
            SessionKind.KEYGEN
          );

          const keyShare = await generateKeyShare(
            websocket,
            worker,
            stream,
            this.state.sink,
            sessionInfo
          );

          this.props.dispatch(setKeyShare(keyShare));

          websocket.notify({
            method: "Session.finish",
            params: [group.uuid, sessionId, partySignup.number],
          });
        } else {
          console.warn(
            "Key generation in progress, refusing to start a new session"
          );
        }
      } else {
        console.warn(
          "Keygen got sessionSignup event for wrong session",
          sessionId,
          this.state.session.uuid
        );
      }
    });

    websocket.on("sessionLoad", async (sessionId: string) => {
      if (sessionId === this.state.session.uuid) {
        const [publicAddress, ,] = this.state.loadedKeyShare;
        const keyShare = findKeyValue(
          this.state.savedKeys,
          this.state.loadedKeyShare
        );

        this.props.dispatch(setKeyShare(keyShare));
        this.props.navigate(`/sign/${publicAddress}`);
      } else {
        console.warn(
          "Keygen got sessionLoad event for wrong session",
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
    websocket.removeAllListeners("sessionLoad");
    websocket.removeAllListeners("sessionClosed");

    // Clean up listeners managed by the sink implementation too.
    websocket.removeAllListeners("sessionMessage");
  }

  render() {
    const websocket = this.context;
    const { session, targetSession, savedKeys } = this.state;

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
        params: [this.props.group.uuid, SessionKind.KEYGEN],
      });

      this.props.dispatch(setKeygenSession(session));
      this.setState({ ...this.state, session });
    };

    // We want to create the sink for receiving messages
    // as early as possible as it is possible for messages
    // to be received before the state machine for this client
    // has been started.
    const createSink = (id: string): WebSocketSink => {
      return new WebSocketSink(
        websocket,
        this.props.group.params.parties - 1,
        id
      );
    };

    const joinSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const session = await websocket.rpc({
        method: "Session.join",
        params: [this.props.group.uuid, targetSession, SessionKind.KEYGEN],
      });

      const sink = createSink(session.uuid);
      this.setState({ ...this.state, session, sink });
      this.props.dispatch(setKeygenSession(session));
    };

    const signupToSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const partyNumber = await websocket.rpc({
        method: "Session.signup",
        params: [
          this.props.group.uuid,
          this.state.session.uuid,
          SessionKind.KEYGEN,
        ],
      });
      const newSession = {
        ...session,
        partySignup: { number: partyNumber, uuid: session.uuid },
      };

      const sink = createSink(session.uuid);
      this.setState({ ...this.state, session: newSession, sink });
      this.props.dispatch(setKeygenSession(newSession));
    };

    const onKeyShareChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      try {
        const value = JSON.parse(e.currentTarget.value);
        this.setState({ ...this.state, loadedKeyShare: value });
      } catch (e) {
        /* May not be JSON data */
      }
    };

    const useSelectedKeyShare = async (
      e: React.MouseEvent<HTMLButtonElement>
    ) => {
      e.preventDefault();
      const [, partyNumber] = this.state.loadedKeyShare;
      await websocket.rpc({
        method: "Session.load",
        params: [
          this.props.group.uuid,
          this.state.session.uuid,
          SessionKind.KEYGEN,
          partyNumber,
        ],
      });

      const { session } = this.state;
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
          <button
            className="create-keygen-session"
            onClick={createKeygenSession}
          >
            Create a key generation session
          </button>
          <p>Or join an existing key generation session:</p>
          <input
            className="keygen-session-id"
            type="text"
            value={targetSession}
            onChange={onTargetSessionChange}
          />
          <button className="join-keygen-session" onClick={joinSession}>
            Join Session
          </button>
        </>
      );
    };

    const SavedKeyShares = () => {
      return (
        <>
          <select
            onChange={onKeyShareChange}
            value={JSON.stringify(this.state.loadedKeyShare)}
          >
            <option value="null">--- Select a key share ---</option>
            {Array.from(savedKeys.keys()).map(
              (
                [publicAddress, partyNumber, parties]: [string, number, number],
                index
              ) => {
                return (
                  <option
                    key={index}
                    value={JSON.stringify([
                      publicAddress,
                      partyNumber,
                      parties,
                    ])}
                  >
                    {publicAddress} : {partyNumber} / {parties}
                  </option>
                );
              }
            )}
          </select>
          <button
            disabled={this.state.loadedKeyShare === null}
            onClick={useSelectedKeyShare}
          >
            Use selected key share
          </button>
        </>
      );
    };

    const KeygenSessionActions = () => {
      return (
        <>
          <p>Key generation session is active.</p>
          <hr />
          <p>Signup to create a new key share</p>
          <button className="keygen-signup" onClick={signupToSession}>
            Keygen Signup
          </button>
          <hr />
          <p>Load a saved key share</p>
          {savedKeys.size > 0 ? (
            <SavedKeyShares />
          ) : (
            <p>No saved key shares yet</p>
          )}
        </>
      );
    };

    const KeygenSession = () => {
      return (
        <>
          <p>
            Session ID: <span className="session-id">{session.uuid}</span> (
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
        <h4>Key Share</h4>
        {session ? <KeygenSession /> : <CreateOrJoinSession />}
      </>
    );
  }
}

const ConnectedKeygen = connect((state: RootState) => {
  return { keyShare: state.keygen.keyShare };
})(Keygen);

export default function KeyGenerator() {
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
        <a href={location.href} target="_blank" rel="noreferrer">
          this link
        </a>{" "}
        in another window/tab or &nbsp;
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
}
