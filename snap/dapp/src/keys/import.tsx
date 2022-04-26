import React, { useState } from 'react';
import {useDispatch} from 'react-redux';

import {
  Alert,
  Breadcrumbs,
  Link,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  Paper,
} from '@mui/material';

import {
  importKeyStore,
} from "@metamask/mpc-snap-wasm";

import FileUploadReader from '../components/file-upload-reader';
import PublicAddress from '../components/public-address';
import {decode} from '../utils';
import {setSnackbar} from '../store/snackbars';
import {findKeyShare, saveKey} from '../store/keys';

const steps = ['Load key store', 'Enter password', 'Import'];

type ImportResult = {
  label: string;
  address: string;
  partyNumber: number;
  parties: number;
}

type UploadKeyStoreProps = {
  setFile: (file: File) => void;
};

function UploadKeyStore(props: UploadKeyStoreProps) {
  const { setFile } = props;
  const onFileSelect = (file?: File) => setFile(file);
  return (
    <Stack marginTop={2}>
      <FileUploadReader onSelect={onFileSelect} />
    </Stack>
  );
}

type EnterPasswordProps = {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  value: string;
};

function EnterPassword(props: EnterPasswordProps) {
  const {onChange, value} = props;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    props.onSubmit();
  }

  return (
    <Stack marginTop={2}>
      <form id="import-password" onSubmit={onSubmit} noValidate>
        <Stack>
          <TextField
            type="password"
            label="Password"
            autoFocus
            value={value}
            onChange={onChange}
          />
        </Stack>
      </form>
    </Stack>
  );
}

type ImportKeyStoreProps = {
  result: ImportResult;
  startAgain: () => void;
}

function ImportKeyStore(props: ImportKeyStoreProps) {
  const { result, startAgain } = props;
  const { label, address, partyNumber, parties } = result;
  const href = `#/keys/${address}`;
  return (
    <Stack>
      <Paper variant="outlined">
        <Stack padding={2} spacing={2}>
          <Stack>
            <Typography variant="h3" component="div">
              {label}
            </Typography>
            <PublicAddress address={address} />
          </Stack>
          <Alert severity="success">
            Imported key share {partyNumber} or {parties}!
          </Alert>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={startAgain}>Import another key share</Button>
            <Button variant="contained" href={href}>Open {label}</Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

function ImportStepper() {
  const dispatch = useDispatch();
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [keyStore, setKeyStore] = useState(null);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);

  const startAgain = () => {
    setActiveStep(0);
    setFile(null);
    setKeyStore(null);
    setPassword("");
    setResult(null);
  }

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassword(e.target.value);

  const readFileBuffer = async () => {
    if (file) {
      const buffer = await file.arrayBuffer();
      try {
        const contents = decode(new Uint8Array(buffer));
        try {
          const keystore = JSON.parse(contents);
          setKeyStore(keystore);
          return keystore;
        } catch (e) {
          console.error(e);
          dispatch(
            setSnackbar({
              message: `Could not parse file as JSON: ${e.message || ""}`,
              severity: "error",
            })
          );
        }
      } catch (e) {
        console.error(e);
        dispatch(
          setSnackbar({
            message: `Could not decode file as UTF-8: ${e.message || ""}`,
            severity: "error",
          })
        );
      }
    }
  };

  const proceed = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const doImportKeyStore = async () => {
    try {
      const keyShare = importKeyStore(password, keyStore);
      const { label } = keyShare;
      const { address, localKey } = keyShare.share;
      const { i: partyNumber, n: parties } = localKey;
      const existingKeyShare = await findKeyShare(address, partyNumber);
      if (!existingKeyShare) {
        await dispatch(saveKey(keyShare));
        dispatch(setSnackbar({
          message: 'Key share imported',
          severity: 'success'
        }));
        const result = {label, address, partyNumber, parties};
        setPassword("");
        setResult(result);
        return result;
      } else {
        dispatch(setSnackbar({
          message: 'Key share already exists',
          severity: 'error'
        }));
      }
    } catch (e) {
      dispatch(setSnackbar({
        message: 'Failed to import keystore',
        severity: 'error'
      }));
    }
  }

  const handleNext = async () => {
    if (activeStep === 0) {
      if (await readFileBuffer()) {
        proceed();
      }
    } else if(activeStep === 1) {
      if (keyStore && password) {
        const result = await doImportKeyStore();
        if (result) {
          proceed();
        }
      }
    }
  };

  const components = [
    <UploadKeyStore key="upload" setFile={setFile} />,
    <EnterPassword
      key="password"
      onSubmit={handleNext}
      onChange={onPasswordChange}
      value={password} />,
  ];

  return (
    <>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => {
          return (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          );
        })}
      </Stepper>
      {
        activeStep < 2 ? (
          <Stack spacing={4}>
            {components[activeStep]}
            <Button variant="contained" onClick={handleNext}>
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Stack>
        ) : (
          <ImportKeyStore result={result} startAgain={startAgain} />
        )
      }
    </>
  );
}

export default function Import() {
  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link underline="hover" color="inherit" href="#/keys">
            Keys
          </Link>
          <Typography color="text.primary">Import</Typography>
        </Breadcrumbs>
        <Typography variant="h3" component="div" gutterBottom>
          Import a key share
        </Typography>
      </Stack>
      <ImportStepper />
    </Stack>
  );
}
