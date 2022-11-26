import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { Stack, Button, Typography } from "@mui/material";

import { AppDispatch } from "../store";
import { keysSelector, saveKey } from "../store/keys";
import { sessionSelector } from "../store/session";

export default function Save() {
  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();
  const { keyShare } = useSelector(keysSelector);
  const { group } = useSelector(sessionSelector);

  if (!group || !keyShare) {
    return (
      <Stack padding={2} spacing={2} marginTop={2}>
        <Stack>
          <Typography variant="h4" component="div">
            Error
          </Typography>
        </Stack>
        <Typography variant="body1" component="div">
          Group information or key share is missing!
        </Typography>
      </Stack>
    );
  }

  const saveKeyShare = async () => {
    await dispatch(saveKey(keyShare));
    navigate("/keys");
  };

  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {group.label}
        </Typography>
      </Stack>
      <Stack>
        <Typography variant="body1" component="div">
          Your key share has been created.
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Save the key share so you can use it to sign messages and
          transactions.
        </Typography>
      </Stack>

      <Button variant="contained" onClick={saveKeyShare}>
        Save key share
      </Button>
    </Stack>
  );
}
