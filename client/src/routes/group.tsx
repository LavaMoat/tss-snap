import React, { useState, useEffect, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { groupSelector } from "../store/group";
import { useParams } from "react-router-dom";
import { WebSocketContext } from "../websocket";

import { Phase } from "../machine-common";

interface GroupProps {}

export default (props: GroupProps) => {
  const [group, setGroup] = useState(null);
  const dispatch = useDispatch();
  const { group: savedGroup } = useSelector(groupSelector);
  const params = useParams();
  const { uuid } = params;
  const websocket = useContext(WebSocketContext);

  const createKeygenSession = async (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();

    const response = await websocket.request({
      kind: "session_create",
      data: { group_id: group.uuid, phase: Phase.KEYGEN },
    });

    const { session } = response.data;

    console.log("Got session create for keygen...", response);
  };

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
        <button onClick={createKeygenSession}>
          Create a key generation session
        </button>
      </>
    );
  } else {
    return null;
  }
};
