import React, { Component, useState, useEffect, useContext } from "react";
import { useSelector, useDispatch, connect } from "react-redux";
import { groupSelector, GroupInfo } from "../store/group";
import { keygenSelector, setKeygen, Session } from "../store/keygen";
import { useParams } from "react-router-dom";
import { WebSocketContext, BroadcastMessage } from "../websocket";
import { AppDispatch } from "../store";

import { Phase } from "../machine-common";

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
      console.log("Got session_create event with session", session);
      this.setState({ ...this.state, session });
    });

    websocket.on("session_ready", (msg: BroadcastMessage) => {
      const { session_id: sessionId } = msg.data;
      if (sessionId === this.state.session.uuid) {
        console.log("GOT KEYGEN SESSION READY EVENT FROM SERVER");
      } else {
        console.warn(
          "Keygen got session_ready event for wrong session",
          sessionId,
          this.state.session.uuid
        );
      }
    });
  }

  componentWillUnmount() {
    const websocket = this.context;
    websocket.removeAllListeners("session_create");
    websocket.removeAllListeners("session_ready");
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

      console.log("Create keygen session: ", {
        group_id: this.props.group.uuid,
        phase: Phase.KEYGEN,
      });

      const session = await websocket.rpc({
        method: "session_create",
        params: [this.props.group.uuid, Phase.KEYGEN],
      });

      this.props.dispatch(setKeygen(session));
      this.setState({ ...this.state, session });
    };

    const joinSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const session = await websocket.rpc({
        method: "session_join",
        params: [this.props.group.uuid, targetSession, Phase.KEYGEN],
      });
      this.props.dispatch(setKeygen(session));
      this.setState({ ...this.state, session });
    };

    const signupToSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const partyNumber = await websocket.rpc({
        method: "session_signup",
        params: [this.props.group.uuid, this.state.session.uuid, Phase.KEYGEN],
      });
      //const { party_number: partyNumber } = response.data;
      session.partySignup = { number: partyNumber, uuid: session.uuid };
      console.log("Got session party signup", session);
      this.props.dispatch(setKeygen(session));
      this.setState({ ...this.state, session });
    };

    const CreateOrJoinSession = () => {
      return (
        <>
          <h3>Key generation</h3>
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

    return session ? <KeygenSession /> : <CreateOrJoinSession />;
  }
}

const ConnectedKeygen = connect(null)(Keygen);

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
        <ConnectedKeygen group={group} />
      </>
    );
  } else {
    return null;
  }
};
