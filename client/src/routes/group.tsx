import React, { Component, useState, useEffect, useContext } from "react";
import { useSelector, useDispatch, connect } from "react-redux";
import { groupSelector, GroupInfo } from "../store/group";
import { keygenSelector, setKeygen, Session } from "../store/keygen";
import { useParams } from "react-router-dom";
import { WebSocketContext, BroadcastMessage } from "../websocket";
import { AppDispatch } from "../store";

import { Phase } from "../machine-common";

interface KeygenProps {
  group: GroupInfo;
  dispatch: AppDispatch;
}

class Keygen extends Component<KeygenProps> {
  static contextType = WebSocketContext;

  componentDidMount() {
    const websocket = this.context;
    websocket.on("session_create", (msg: BroadcastMessage) => {
      console.log(
        "Client got websocket session create broadcast message",
        msg.data
      );
    });
  }

  componentWillUnmount() {
    const websocket = this.context;
    websocket.removeAllListeners("session_create");
    console.log(
      "Keygen did unmount !!!!",
      websocket.listenerCount("session_create")
    );
  }

  render() {
    const websocket = this.context;
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
      console.log("Got session create for keygen...", response);
    };

    return (
      <>
        <h3>Key generation</h3>
        <button onClick={createKeygenSession}>
          Create a key generation session
        </button>
      </>
    );
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
      //dispatch(setGroup(group));
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
        <p>
          Join <a href={location.href}>this group</a> in another window or tab
        </p>
        <p>Parties: {group.params.parties}</p>
        <p>Threshold: {group.params.threshold}</p>
        <hr />
        <ConnectedKeygen group={group} />
      </>
    );
  } else {
    return null;
  }
};
