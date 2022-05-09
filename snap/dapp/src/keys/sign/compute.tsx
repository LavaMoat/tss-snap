import React, { useEffect, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";

import { Box, Chip, Stack, Typography, CircularProgress } from "@mui/material";

import { SessionInfo, sign} from "@metamask/mpc-client";

import { setKeyShare } from "../../store/keys";
import { sessionSelector } from "../../store/session";
import { WebSocketContext } from "../../websocket-provider";
import { WorkerContext } from "../../worker";
import { SigningType } from '../../types';
import PublicAddress from "../../components/public-address";

type ComputeProps = {
  next: () => void;
}

function WaitForApproval() {
  const websocket = useContext(WebSocketContext);

  useEffect(() => {
    websocket.once("sessionSignup", async (sessionId: string) => {
      console.log("Got session signup event", sessionId);
    });
  }, []);

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <CircularProgress size={20} />
      <Typography variant="body2" component="div" color="text.secondary">
        Waiting for approval...
      </Typography>
    </Stack>
  );
}

export default function Compute(props: ComputeProps) {
  const { next } = props;

  const dispatch = useDispatch();
  const worker = useContext(WorkerContext);
  const websocket = useContext(WebSocketContext);
  const { group, session, transport, signCandidate } = useSelector(sessionSelector);

  console.log("Sign candidate compute running", signCandidate);

  const { address, signingType, selectedParty } = signCandidate;

  const { label } = group;

  useEffect(() => {
    const startCompute = async () => {
      console.log("TODO: start the computation, websocket", websocket);
      console.log("TODO: start the computation, group", group);
      console.log("TODO: start the computation, session", session);
      console.log("TODO: start the computation, transport", transport);

      /*
          const { signature: signResult, address: publicAddress } = await sign(
            websocket,
            worker,
            stream,
            sink,
            hash,
            keyShare,
            group,
            partySignup
          );
      */

      /*
      const onTransition = (previousRound: string, current: string) => {
        console.log("UI thread onTransition called", current);
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

      console.log("TODO: start the computation, sessionInfo", sessionInfo);
      console.log("TODO: start the computation, sessionInfo", worker);

      // Stash the key share for save confirmation on the
      // next screen
      const { label } = group;
      const namedKeyShare = { label, share };
      dispatch(setKeyShare(namedKeyShare));

      next();
      */
    };
    //startCompute();
  }, []);


      //<Stack>
        //<Typography variant="body1" component="div">
          //Computing the key share
        //</Typography>
        //<Typography variant="body2" component="div" color="text.secondary">
          //Please be patient, this may take a while...
        //</Typography>
      //</Stack>

  return (
    <Stack padding={1} spacing={2} marginTop={2}>
      <Stack>
        <Typography variant="h4" component="div">
          {label}
        </Typography>
        <Stack direction="row" alignItems="center">
          <PublicAddress address={address} />
          <Box sx={{flexGrow: 1}} />
          <Chip
            label={`Using key share for party #${selectedParty}`} />
        </Stack>
      </Stack>
      <WaitForApproval />
    </Stack>
  );
}
