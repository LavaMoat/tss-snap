import React, { useState } from "react";

import {
  Stack,
  Box,
  ButtonGroup,
  Button,
  Input,
  Paper,
  Typography,
  IconButton,
} from "@mui/material";

import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';

import { getDroppedFiles, humanFileSize } from "../utils";

// 8MB for file uploads
const MAX_FILE_SIZE = 8388608;

export type FileBuffer = {
  name: string;
  size: number;
  buffer: ArrayBuffer;
};

type FileUploadReaderProps = {
  onSelect: (file: File) => void;
  onChange: (file: FileBuffer) => void;
  //name?: string;
};

export default function FileUploadReader(props: FileUploadReaderProps) {
  const { onSelect, onChange } = props;
  const [fileError, setFileError] = useState(false);
  const [file, setFile] = useState(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    if (file.size <= MAX_FILE_SIZE) {
      setFile(file);
      onSelect(file);
    } else {
      // TODO: handle too large file error gracefully
      setFileError(true);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    return false;
  };

  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    const files = getDroppedFiles(e);
    // TODO: handle drop of more than one file?
    if (files.length > 0) {
      const file = files[0];
      if (file.size <= MAX_FILE_SIZE) {
        setFile(file);
        onSelect(file);
      } else {
        // TODO: handle too large file error gracefully
        setFileError(true);
      }
    }
  };

  const readFileBuffer = async () => {
    if (file) {
      const { name, size } = file;
      const buffer = await file.arrayBuffer();
      onChange({ name, size, buffer });
    }
  };

  return (
    <>
      <Input
        id="file-upload"
        sx={{ display: "none" }}
        onChange={onFileChange}
        type="file"
      />
      <label htmlFor="file-upload">
        <Paper variant="outlined" onDragOver={onDragOver} onDrop={onDrop}>
          <Stack padding={4}>
            {file ? (
              <Stack direction="row">
                <Stack direction="row" spacing={2}>
                  <IconButton onClick={() => setFile(null)}
                    sx={{width: 40, height: 40}}>
                    <RemoveCircleIcon />
                  </IconButton>
                  <Stack>
                    <Typography variant="body1">{file.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {humanFileSize(file.size)}
                    </Typography>
                  </Stack>
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                <ButtonGroup size="small" variant="outlined">
                  <Button onClick={readFileBuffer}>Upload</Button>
                </ButtonGroup>
              </Stack>
            ) : (
              <>
                <Typography variant="body1">Click to select a file</Typography>
                <Typography variant="body2" color="text.secondary">
                  Or drop the file here
                </Typography>
              </>
            )}
          </Stack>
        </Paper>
      </label>
    </>
  );
}
