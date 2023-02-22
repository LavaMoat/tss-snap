export const onRpcRequest = ({ origin, request }) => {
  console.log("Snap running...");

  switch (request.method) {
    case "getState":
      return wallet.request({
        method: "snap_manageState",
        params: {operation: "get"},
      });
    case "updateState":
      return wallet.request({
        method: "snap_manageState",
        params: {operation: "update", newState: request.params},
      });
    case "clearState":
      return wallet.request({
        method: "snap_manageState",
        params: {operation: "clear"},
      });
    default:
      throw new Error("Method not found.");
  }
};
