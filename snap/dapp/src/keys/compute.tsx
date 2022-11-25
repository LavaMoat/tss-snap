import React, { useEffect, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Stack, Typography } from "@mui/material";

import { SessionInfo, generateKeyShare } from "@lavamoat/mpc-client";

import { setKeyShare } from "../store/keys";
import { sessionSelector } from "../store/session";
import {
  setWorkerProgress,
  clearWorkerProgress,
} from "../store/worker-progress";
import { WorkerContext } from "../worker";

import { StepProps } from "./create";
import WorkerProgress from "./worker-progress";

export default function Compute(props: StepProps) {
  const { next } = props;

  const dispatch = useDispatch();
  const worker = useContext(WorkerContext);
  const { group, session, transport } = useSelector(sessionSelector);

  useEffect(() => {
    const totalRounds = 5;
    let currentRound = 1;

    const startCompute = async () => {
      const onTransition = (previousRound: string, current: string) => {
        let message = "";
        if (previousRound) {
          message = `Transition from ${previousRound} to ${current}`;
        } else {
          message = `Transition to ${current}`;
        }

        const workerInfo = { message, totalRounds, currentRound };
        dispatch(setWorkerProgress(workerInfo));
        currentRound++;
      };

      const { stream, sink } = transport;
      const { uuid: groupId, params: parameters } = group;
      const { partySignup, uuid: sessionId } = session;

      const sessionInfo: SessionInfo = {
        groupId,
        sessionId,
        parameters,
        partySignup,
      };

      const share = await generateKeyShare(
        worker,
        stream,
        sink,
        sessionInfo,
        onTransition
      );

      // Stash the key share for save confirmation on the
      // next screen
      const { label } = group;
      const namedKeyShare = { label, share };
      dispatch(setKeyShare(namedKeyShare));

      dispatch(clearWorkerProgress());
      next();
    };
    startCompute();
  }, []);

  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      <Typography variant="h4" component="div">
        {group.label}
      </Typography>
      <WorkerProgress title="Computing the key share" />
    </Stack>
  );
}
