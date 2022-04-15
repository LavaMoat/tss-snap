import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  dialogsSelector,
  setDialogVisible,
  CONFIRM_DELETE_KEY_SHARE,
} from "../store/dialogs";

import {deleteKey} from '../store/keys';

import ConfirmDeleteKeyShareDialog from "./confirm-delete-key-share";

export type DeleteRequest = [string, number, number];

export default function Dialogs() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { dialogs } = useSelector(dialogsSelector);

  const onDeleteKeyShare = async (result: DeleteRequest) => {
    cancelDialog(CONFIRM_DELETE_KEY_SHARE);
    const [address, number, length] = result;

    await dispatch(deleteKey([address, number]));

    // TODO: restore snackbar

    // Deleting the last key share so navigate
    // to the keys list rather than show a 404
    if (length === 1) {
      navigate("/keys");
    }
  };

  const cancelDialog = (key: string) => {
    dispatch(setDialogVisible([key, false, null]));
  };

  return (
    <>
      <ConfirmDeleteKeyShareDialog
        open={dialogs[CONFIRM_DELETE_KEY_SHARE][0] || false}
        handleCancel={() => cancelDialog(CONFIRM_DELETE_KEY_SHARE)}
        handleOk={onDeleteKeyShare}
        request={(dialogs[CONFIRM_DELETE_KEY_SHARE][1] || []) as DeleteRequest}
      />
    </>
  );
}
