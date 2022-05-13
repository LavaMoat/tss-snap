import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { exportKeyStore } from "@metamask/mpc-snap-wasm";

import {
  dialogsSelector,
  setDialogVisible,
  CONFIRM_DELETE_KEY_SHARE,
  EXPORT_KEY_STORE,
  CONFIRM_DELETE_MESSAGE_PROOF,
} from "../store/dialogs";

import { deleteKey, findKeyShare } from "../store/keys";
import { deleteMessageProof } from "../store/proofs";
import { setSnackbar } from "../store/snackbars";
import { encode, download } from "../utils";
import { SignProof } from "../types";

import ConfirmDeleteKeyShareDialog from "./confirm-delete-key-share";
import ConfirmDeleteMessageProofDialog from "./confirm-delete-message-proof";
import ExportKeyStoreDialog from "./export-keystore";

export type DeleteKeyShare = [string, number, number];
export type ExportKeyStore = [string, number, number];
export type DeleteMessageProof = [string, SignProof];

export default function Dialogs() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { dialogs } = useSelector(dialogsSelector);

  const onDeleteKeyShare = async (result: DeleteKeyShare) => {
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

  const onDeleteMessageProof = async (result: DeleteMessageProof) => {
    const [address, proof] = result;
    await dispatch(deleteMessageProof([address, proof.value.digest]));
    dispatch(
      setSnackbar({
        message: "Message proof deleted",
        severity: "success",
      })
    );
    cancelDialog(CONFIRM_DELETE_MESSAGE_PROOF);
  }

  const cancelDialog = (key: string) => {
    dispatch(setDialogVisible([key, false, null]));
  };

  return (
    <>
      <ConfirmDeleteKeyShareDialog
        open={dialogs[CONFIRM_DELETE_KEY_SHARE][0] || false}
        handleCancel={() => cancelDialog(CONFIRM_DELETE_KEY_SHARE)}
        handleOk={onDeleteKeyShare}
        request={(dialogs[CONFIRM_DELETE_KEY_SHARE][1] || []) as DeleteKeyShare}
      />

      <ExportKeyStoreDialog
        open={dialogs[EXPORT_KEY_STORE][0] || false}
        handleCancel={() => cancelDialog(EXPORT_KEY_STORE)}
        handleOk={onExportKeyStore}
        request={(dialogs[EXPORT_KEY_STORE][1] || []) as ExportKeyStore}
      />

      <ConfirmDeleteMessageProofDialog
        open={dialogs[CONFIRM_DELETE_MESSAGE_PROOF][0] || false}
        handleCancel={() => cancelDialog(CONFIRM_DELETE_MESSAGE_PROOF)}
        handleOk={onDeleteMessageProof}
        request={(dialogs[CONFIRM_DELETE_MESSAGE_PROOF][1] || []) as DeleteMessageProof}
      />

    </>
  );
}
