import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  ButtonGroup,
  Button,
  List,
  ListSubheader,
  ListItem,
  ListItemText,
} from "@mui/material";

import { SignProof, SignMessage } from "../types";
import { encode, download, toHexString } from "../utils";
import {
  loadMessageProofs,
  deleteMessageProof,
  proofsSelector,
} from "../store/proofs";

type MessageProofProps = {
  address: string;
};

export default function MessageProofs(props: MessageProofProps) {
  const dispatch = useDispatch();
  const { address } = props;
  const { messages } = useSelector(proofsSelector);
  const items: SignProof[] = messages[address] || [];

  useEffect(() => {
    const getMessageProofs = async () => {
      await dispatch(loadMessageProofs());
    };
    getMessageProofs();
  }, []);

  const onExportMessageProof = (proof: SignProof) => {
    const dt = new Date();
    dt.setTime(proof.timestamp);
    const fileName = `${address}-${toHexString(
      proof.value.digest
    )}-${dt.toISOString()}.json`;
    const buffer = encode(JSON.stringify(proof, undefined, 2));
    download(fileName, buffer);
  };

  const onDeleteMessageProof = (proof: SignProof) => {
    dispatch(deleteMessageProof([address, proof.value.digest]));
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <List
      component="div"
      subheader={<ListSubheader component="div">Proofs</ListSubheader>}
    >
      {items.map((proof: SignProof, index: number) => {
        return (
          <ListItem key={index}>
            <ListItemText secondary={toHexString(proof.value.digest)}>
              {(proof.value as SignMessage).message}
            </ListItemText>
            <ButtonGroup
              variant="outlined"
              size="small"
              aria-label="message proof actions"
            >
              <Button onClick={() => onExportMessageProof(proof)}>
                Export
              </Button>
              <Button color="error" onClick={() => onDeleteMessageProof(proof)}>
                Delete
              </Button>
            </ButtonGroup>
          </ListItem>
        );
      })}
    </List>
  );
}
