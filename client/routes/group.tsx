import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { groupSelector } from "../store/group";
import { useParams } from "react-router-dom";

interface GroupProps {
  sendWorkerMessage: (message: any, transfer?: Transferable[]) => void;
}

export default (props: GroupProps) => {
  const { sendWorkerMessage } = props;
  const [group, setGroup] = useState(null);
  const { group: savedGroup } = useSelector(groupSelector);
  const params = useParams();

  useEffect(() => {
    // Group creator already has the group info
    if (savedGroup) {
      setGroup(savedGroup);
      // Otherwise try to join the group
    } else {
      sendWorkerMessage({ type: "group_join", uuid: params.uuid });
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
      </>
    );
  } else {
    return null;
  }
};
