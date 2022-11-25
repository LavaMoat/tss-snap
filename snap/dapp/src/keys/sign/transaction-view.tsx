import React from "react";

import { Box, Stack, Paper, Typography, Divider } from "@mui/material";
import { toHexString, getChainName } from "../../utils";
import { utils, UnsignedTransaction } from "ethers";

type SignTransactionViewProps = {
  isSigned?: boolean,
  transaction: UnsignedTransaction;
  digest: Uint8Array;
};

export default function SignMessageView(props: SignTransactionViewProps) {
  const { transaction, digest, isSigned } = props;

  //console.log(transaction);

  const { to } = transaction;
  const value = utils.formatEther(transaction.value);
  const gasPrice = utils.formatEther(transaction.gasPrice);

  const chainName = getChainName(transaction.chainId);

  return (
    <Paper variant="outlined">
      <Stack padding={2} spacing={2}>
        <Stack direction="row">
          <Typography variant="subtitle1" component="div">
            Transaction to {isSigned ? 'send' : 'sign'}
          </Typography>
        </Stack>

        <Divider />
        <Stack spacing={1}>
          <Stack direction="row">
            <Box flexGrow={1}>
              <Typography variant="body1" component="div">
                Network:
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" component="div">
                {chainName}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row">
            <Box flexGrow={1}>
              <Typography variant="body1" component="div">
                To:
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" component="div">
                {to}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row">
            <Box flexGrow={1}>
              <Typography variant="body1" component="div">
                Value:
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" component="div">
                {value} ETH
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row">
            <Box flexGrow={1}>
              <Typography variant="body1" component="div">
                Gas price:
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" component="div">
                {gasPrice} ETH
              </Typography>
            </Box>
          </Stack>
        </Stack>
        <Divider />
        <Typography variant="body2" component="div" color="text.secondary">
          {toHexString(digest)}
        </Typography>
      </Stack>
    </Paper>
  );
}
