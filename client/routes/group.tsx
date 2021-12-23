import React, { useState, useEffect } from "react";

interface GroupProps {
  sendWorkerMessage: (message: any, transfer?: Transferable[]) => void;
}

export default (props: GroupProps) => {
  /*
  const navigate = useNavigate();
  const { sendWorkerMessage } = props;
  const { group } = useSelector(groupSelector);

  const onCreateGroupSubmit = (groupData: GroupFormData) => {
    sendWorkerMessage({ type: "group_create", groupData });
  };

  useEffect(() => {
    if (group) {
      navigate(`/group/${group.uuid}`);
    }
  }, [group]);

  if (group) {
    return null;
  }

  */

  return <p>Render the group view...</p>;
};
