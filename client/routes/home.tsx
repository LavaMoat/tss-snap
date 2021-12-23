import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { groupSelector } from "../store/group";
import { useNavigate } from "react-router-dom";
import { Parameters } from "../machine-common";

interface CreateGroupProps {
  onSubmit: (data: GroupFormData) => void;
}

interface GroupFormData {
  label: string;
  params: Parameters;
}

const CreateGroup = (props: CreateGroupProps) => {
  const [label, setLabel] = useState("");

  const onLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    setLabel(event.currentTarget.value);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: get parties / threshold from form fields
    props.onSubmit({ label, params: { parties: 3, threshold: 1 } });
  };

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="label">Group label:</label>
      <input id="label" type="text" onChange={onLabelChange} value={label} />
      <input type="submit" value="Create Group" />
    </form>
  );
};

interface HomeProps {
  sendWorkerMessage: (message: any, transfer?: Transferable[]) => void;
}

export default (props: HomeProps) => {
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

  return <CreateGroup onSubmit={onCreateGroupSubmit} />;
};
