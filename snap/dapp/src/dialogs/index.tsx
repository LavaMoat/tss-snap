import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { exportKeyStore } from "@metamask/mpc-snap-wasm";

import {
  dialogsSelector,
  setDialogVisible,
  CONFIRM_DELETE_KEY_SHARE,
  EXPORT_KEY_STORE,
} from "../store/dialogs";

import { deleteKey, findKeyShare } from "../store/keys";
import { setSnackbar } from "../store/snackbars";
import { encode, download } from "../utils";

import ConfirmDeleteKeyShareDialog from "./confirm-delete-key-share";
import ExportKeyStoreDialog from "./export-keystore";

export type DeleteRequest = [string, number, number];
export type ExportKeyStore = [string, number, number];

export default function Dialogs() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { dialogs } = useSelector(dialogsSelector);

  const onDeleteKeyShare = async (result: DeleteRequest) => {
    cancelDialog(CONFIRM_DELETE_KEY_SHARE);
    const [address, number, length] = result;

    await dispatch(deleteKey([address, number]));

    dispatch(
      setSnackbar({
        message: "Key share deleted",
        severity: "success",
      })
    );

    // Deleting the last key share so navigate
    // to the keys list rather than show a 404
    if (length === 1) {
      navigate("/keys");
    }
  };

  const onExportKeyStore = async (result: ExportKeyStore, password: string) => {
    const [address, number, length] = result;
    const keyShare = await findKeyShare(address, number);
    if (!keyShare) {
      throw new Error("unable to find key share for export");
    }
    const keyStore = exportKeyStore(address, password, keyShare);
    const fileName = `${address}-${number}-${length}.json`;
    const buffer = encode(JSON.stringify(keyStore, undefined, 2));
    download(fileName, buffer);

    dispatch(
      setSnackbar({
        message: "Key store exported",
        severity: "success",
      })
    );

    cancelDialog(EXPORT_KEY_STORE);
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

      <ExportKeyStoreDialog
        open={dialogs[EXPORT_KEY_STORE][0] || false}
        handleCancel={() => cancelDialog(EXPORT_KEY_STORE)}
        handleOk={onExportKeyStore}
        request={(dialogs[EXPORT_KEY_STORE][1] || []) as ExportKeyStore}
      />
    </>
  );
}
