import React, { useState } from "react";

interface CreateGroupProps {
  onSubmit: (data: GroupData) => void;
}

interface GroupData {
  label: string;
  parties: number;
  threshold: number;
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
    props.onSubmit({ label, parties: 3, threshold: 1 });
  };

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="label">Group label:</label>
      <input id="label" type="text" onChange={onLabelChange} value={label} />
      <input type="submit" value="Create Group" />
    </form>
  );
};

interface GroupProps {
  sendWorkerMessage: (message: any, transfer?: Transferable[]) => void;
}

export default (props: GroupProps) => {
  const { sendWorkerMessage } = props;

  const onCreateGroupSubmit = (groupData: GroupData) => {
    console.log("Got create group data", groupData);
    sendWorkerMessage({ type: "group_create", groupData });
  };

  return <CreateGroup onSubmit={onCreateGroupSubmit} />;
};
