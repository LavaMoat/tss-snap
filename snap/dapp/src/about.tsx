import React from "react";

import { Stack, Typography } from "@mui/material";

export default function About() {
  return (
    <>
      <Stack spacing={2}>
        <Typography variant="h3" component="div" gutterBottom>
          About
        </Typography>
        <Typography variant="body1" component="div" gutterBottom>
          Threshold signature schemes (TSS) allow multiple collaborating participants to sign a message or transaction.
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          The private key is shared between the participants using a technique called multi-party computation (MPC) which ensures that the entire private key is never exposed to any participant; the process for generating key shares is called distributed key generation (DKG).
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          Before a signature can be generated all participants must generate key shares using DKG and store their key shares securely; the number of participants and threshold for signature generation must be decided in advance.
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          Unlike other techniques such as Shamirs Secret Sharing (SSS) the entire private key is never revealed to any single participant and is therefore more secure as it does not have the <em>trusted dealer</em> problem.
        </Typography>

        <Typography variant="h4" component="div" gutterBottom>
          Use Case
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          One use case for TSS is to support multi-factor authentication for a
          single user. For example; a single user could generate key shares for two participants and with threshold of two (called a 2 of 2) and store each key share on separate devices. When they want to sign a transaction they would need to interactively collaborate using the different devices. This means that if a single device is stolen or lost then the ability to sign transactions is not compromised; however if both devices were lost and both key shares were acquired the private key is lost.

        </Typography>
        <Typography variant="body1" component="div" gutterBottom>
          This is a simple scenario that does not cater for backup key shares; in reality even with two devices it would be better to generate a 2 of 4 and store two of the key shares securely on multiple redundant storage devices in case the primary key shares were lost or stolen.

          If you have a laptop, phone and tablet a 2 of 5 could be appropriate. Store a primary key share on each device and backup the remaining two redundant key shares securely. In this scenario (unlike the 2 of 2) the loss of a single device does not deny you the ability to sign transactions.
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          Another use case is for organizations that would like multiple stakeholders to approve transactions. By using a threshold signature scheme and assigning key shares to multiple stakeholders transactions can only be approved when a threshold of stakeholders agree on the transaction.
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          For organizations, signing messages using a threshold signature scheme could also be used as a simple voting mechanism.
        </Typography>

        <Typography variant="body1" component="div" gutterBottom>
          These scenarios using multiple users to approve transactions or messages can be achieved using smart contracts and where logic is required a smart contract will be the appropriate choice however if there is no logic then using a threshold signature scheme removes the upfront burden of programming a smart contract and will be cheaper as it does not incur the gas fees of smart contract calls.
        </Typography>
      </Stack>
    </>
  );
}
