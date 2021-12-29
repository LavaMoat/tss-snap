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
    websocket.on("session_create", (msg: BroadcastMessage) => {
      const { session } = msg.data;
      this.setState({ ...this.state, session });
    });
  }

  componentWillUnmount() {
    const websocket = this.context;
    websocket.removeAllListeners("session_create");
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

      const response = await websocket.request({
        kind: "session_create",
        data: { group_id: this.props.group.uuid, phase: Phase.KEYGEN },
      });

      const { session } = response.data;
      this.props.dispatch(setKeygen(session));
      this.setState({ ...this.state, session });
    };

    const joinSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      const sessionId = targetSession;

      const response = await websocket.request({
        kind: "session_join",
        data: { group_id: this.props.group.uuid, session_id: sessionId },
      });

      const { session } = response.data;
      this.props.dispatch(setKeygen(session));
      this.setState({ ...this.state, session });
    };

    const signupToSession = async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      console.log(
        "Party opts in to key generation sign up...",
        this.state.session
      );
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

    const KeygenSession = () => {
      return (
        <>
          <p>
            Key generation session is active do you wish to signup for key
            generation?
          </p>
          <p>Session ID: {session.uuid}</p>
          <button onClick={signupToSession}>Keygen Signup</button>
          <button onClick={(e) => copyToClipboard(e, session.uuid)}>
            Copy Session ID to Clipboard
          </button>
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
      const response = await websocket.request({
        kind: "group_join",
        data: { uuid },
      });
      const { group } = response.data;
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
