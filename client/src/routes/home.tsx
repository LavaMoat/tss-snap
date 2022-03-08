import React, { useState, useEffect, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { groupSelector } from "../store/group";
import { useNavigate } from "react-router-dom";
import { Parameters } from "../mpc";
import { WebSocketContext } from "../websocket-provider";
import { setGroup } from "../store/group";

interface CreateGroupProps {
  onSubmit: (data: GroupFormData) => void;
}

type GroupFormData = [string, Parameters];

const CreateGroup = (props: CreateGroupProps) => {
  const [label, setLabel] = useState("Test Group");
  const [parties, setParties] = useState(3);
  const [threshold, setThreshold] = useState(1);
  const [maxThreshold, setMaxThreshold] = useState(2);

  const onLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    setLabel(event.currentTarget.value);
  };

  const onPartiesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const value = parseInt(event.currentTarget.value);
    setParties(value);
    setMaxThreshold(value - 1);
    if (threshold > value - 1) {
      setThreshold(value - 1);
    }
  };

  const onThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const value = parseInt(event.currentTarget.value);
    setThreshold(value);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit([label, { parties, threshold }]);
  };

  return (
    <>
      <h2>Group</h2>
      <p>
        To get started create a group; the group will be used for all key
        generation and message signing communication. Groups are limited to 16
        parties and the threshold may not exceed the number of parties.
      </p>
      <form className="group" onSubmit={onSubmit}>
        <div>
          <label htmlFor="label">Label:</label>
          <input
            id="label"
            placeholder="Enter a group label"
            type="text"
            onChange={onLabelChange}
            value={label}
          />
        </div>
        <div>
          <label htmlFor="parties">Parties:</label>
          <input
            id="parties"
            type="number"
            onChange={onPartiesChange}
            min={2}
            max={16}
            value={parties}
          />
        </div>
        <div>
          <label htmlFor="threshold">Threshold:</label>
          <input
            id="threshold"
            type="number"
            onChange={onThresholdChange}
            min={1}
            max={maxThreshold}
            value={threshold}
          />
        </div>
        <input type="submit" value="Create Group" />
      </form>
    </>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const { group } = useSelector(groupSelector);
  const dispatch = useDispatch();
  const websocket = useContext(WebSocketContext);

  const onCreateGroupSubmit = async (params: GroupFormData) => {
    const uuid = await websocket.rpc({
      method: "Group.create",
      params,
    });
    const group = { label: params[0], params: params[1], uuid };
    dispatch(setGroup(group));
  };

  useEffect(() => {
    if (group) {
      navigate(`/keygen/${group.uuid}`);
    }
  }, [group]);

  if (group) {
    return null;
  }

  return <CreateGroup onSubmit={onCreateGroupSubmit} />;
}
