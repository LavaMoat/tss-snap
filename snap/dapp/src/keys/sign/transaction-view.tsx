import React from "react";

import { Box, Stack, Paper, Typography, Divider } from "@mui/material";
import { toHexString, getChainName } from "../../utils";
import { formatEther, formatUnits, toBeHex, Transaction } from "ethers";

type SignTransactionViewProps = {
  isSigned?: boolean,
  transaction: Transaction;
  digest: Uint8Array;
};

export default function SignTransactionView(props: SignTransactionViewProps) {
  const { transaction, digest, isSigned } = props;

  //console.log(transaction);

  const { to } = transaction;
  const value = formatEther(transaction.value);
  const chainName = getChainName(toBeHex(transaction.chainId));

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
                Tip:
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" component="div">
                {formatUnits(transaction.maxPriorityFeePerGas, "wei")} WEI
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row">
            <Box flexGrow={1}>
              <Typography variant="body1" component="div">
                Max gas fee:
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" component="div">
                {formatUnits(transaction.maxFeePerGas, "wei")} WEI
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
