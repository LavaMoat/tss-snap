import React from 'react';

import {StepProps} from '.';

import { SigningType } from "../../../types";

import SaveProof from "../save-proof";
import SendTransaction from "../send-transaction";

export default function Finish(props: StepProps) {
  const {signingType} = props;
  if (signingType == SigningType.MESSAGE) {
    return <SaveProof />
  } else {
    return <SendTransaction />
  }
}
