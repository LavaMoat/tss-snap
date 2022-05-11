import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import {
  ButtonGroup,
  Button,
  List,
  ListSubheader,
  ListItem,
  ListItemText,
} from "@mui/material";

import { SignProof, SignMessage } from '../types';
import { encode, download, toHexString } from '../utils';
import { getMessageProofs } from '../store/proofs';

type MessageProofProps = {
  address: string;
}

export default function MessageProofs(props: MessageProofProps) {
  const dispatch = useDispatch();
  const { address } = props;
  const [items, setItems] = useState<SignProof[]>([]);

  useEffect(() => {
    const loadMessageProofs = async () => {
      const proofs = await dispatch(getMessageProofs(address));
      setItems(proofs.payload);
    }
    loadMessageProofs();
  }, [address]);

  const onExportMessageProof = (proof: SignProof) => {
    const dt = new Date();
    dt.setTime(proof.timestamp);
    const fileName = `${address}-${toHexString(
      proof.value.digest
    )}-${dt.toISOString()}.json`;
    const buffer = encode(JSON.stringify(proof, undefined, 2));
    download(fileName, buffer);
  }

  const onDeleteMessageProof = (proof: SignProof) => {
    console.log("Delete message proof", proof);
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
              <Button
                onClick={() =>
                  onExportMessageProof(proof)
                }
              >
                Export
              </Button>
              <Button
                color="error"
                onClick={() =>
                  onDeleteMessageProof(proof)
                }
              >
                Delete
              </Button>
            </ButtonGroup>
          </ListItem>
        );
      })}
    </List>
  )
}
