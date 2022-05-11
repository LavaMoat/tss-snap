import React from "react";
import { useSelector } from "react-redux";

import { Stack, Box, Typography, LinearProgress } from "@mui/material";

import { workerProgressSelector } from "../store/worker-progress";

type WorkerProgressProps = {
  title: string;
}

export default function WorkerProgress(props: WorkerProgressProps) {
  const { title } = props;
  const { progress } = useSelector(workerProgressSelector);
  const { message, currentRound, totalRounds } = progress;
  return (
    <Stack spacing={1}>
      <Stack>
        <Typography variant="body1" component="div">
          {title}
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          Please be patient, this may take a while...
        </Typography>
      </Stack>
      <Stack>
        <Stack direction="row">
          <Typography variant="body2" component="div" color="text.secondary">
            {message}
          </Typography>
          <Box sx={{flexGrow: 1}} />
          <Typography variant="body2" component="div" color="text.secondary">
            {currentRound}/{totalRounds}
          </Typography>
        </Stack>
        <LinearProgress />
      </Stack>
    </Stack>
  );
}
