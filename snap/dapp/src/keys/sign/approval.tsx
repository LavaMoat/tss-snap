import React, { useState } from "react";

import { Stack, Checkbox, FormControlLabel, Button } from "@mui/material";

import { SigningType } from "../../types";

type ApprovalProps = {
  signingType: SigningType;
  onApprove: () => void;
};

export default function Approval(props: ApprovalProps) {
  const [approved, setApproved] = useState(false);
  const { signingType, onApprove } = props;
  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={<Checkbox />}
        onChange={() => setApproved(!approved)}
        label={`I approve this ${signingType}`}
      />
      <Button disabled={!approved} variant="contained" onClick={onApprove}>
        Sign {signingType}
      </Button>
    </Stack>
  );
}
