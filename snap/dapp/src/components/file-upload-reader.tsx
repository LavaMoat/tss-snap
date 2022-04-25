import React, { useState } from "react";

import {
  Stack,
  Input,
  Paper,
  Typography,
  IconButton,
} from "@mui/material";

import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';

import { getDroppedFiles, humanFileSize } from "../utils";

type FileUploadReaderProps = {
  onSelect: (file: File) => void;
};

export default function FileUploadReader(props: FileUploadReaderProps) {
  const { onSelect } = props;
  const [file, setFile] = useState(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("onFileChange fired...");
    const file = e.target.files[0];
    setFile(file);
    onSelect(file);
  };

  const removeFile = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    setFile(null);
    onSelect(null);
  }

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
      setFile(file);
      onSelect(file);
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
                  <IconButton
                    onClick={removeFile}
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
