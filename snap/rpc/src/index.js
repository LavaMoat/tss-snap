wallet.registerRpcMessageHandler(async (originString, requestObject) => {
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
    case 'hello':
      return wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: `Hello, ${originString}!`,
            description:
              'This custom confirmation is just for display purposes.',
            textAreaContent:
              'But you can edit the snap source code to make it do something, if you want to!',
          },
        ],
      });
    default:
      throw new Error('Method not found.');
  }
});
