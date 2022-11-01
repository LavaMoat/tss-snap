export const onRpcRequest = ({ origin, request }) => {
  console.log("Snap running...");

  switch (request.method) {
    case "getState":
      return wallet.request({
        method: "snap_manageState",
        params: ["get"],
      });
    case "updateState":
      return wallet.request({
        method: "snap_manageState",
        params: ["update", request.params],
      });
    case "clearState":
      return wallet.request({
        method: "snap_manageState",
        params: ["clear"],
      });
    default:
      throw new Error("Method not found.");
  }
}
