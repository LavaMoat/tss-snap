wallet.registerRpcMessageHandler(async (originString, requestObject) => {
  console.log("Snap running...");

  switch (requestObject.method) {
    case "getState":
      return wallet.request({
        method: "snap_manageState",
        params: ["get"],
      });
    case "updateState":
      return wallet.request({
        method: "snap_manageState",
        params: ["update", requestObject.params],
      });
    case "clearState":
      return wallet.request({
        method: "snap_manageState",
        params: ["clear"],
      });
    default:
      throw new Error("Method not found.");
  }
});
