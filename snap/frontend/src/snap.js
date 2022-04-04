wallet.registerRpcMessageHandler(async (originString, requestObject) => {
  console.log("Foo tjhis is adds das sdsfsdfdsfs...");
  console.log("sdfsdfdsfd sd ds fdfs");
  switch (requestObject.method) {
    case 'getKey':
      return wallet.request({
        method: 'snap_getBip44Entropy_60',
      });
    case 'getState':
      return wallet.request({
        method: 'snap_manageState',
        params: ['get'],
      });
    case 'updateState':
      return wallet.request({
        method: 'snap_manageState',
        params: ['update', requestObject.params],
      });
    case 'clearState':
      return wallet.request({
        method: 'snap_manageState',
        params: ['clear'],
      });
    default:
      throw new Error('Method not found.');
  }
});
