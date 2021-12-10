export const makeWebSocketClient = ({
  url,
  onOpen,
  onClose,
  onBroadcastMessage,
}) => {
  // Websocket state
  let messageId = 0;
  let messageRequests = new Map();
  const websocket = new WebSocket(url);

  websocket.onopen = () => onOpen();
  websocket.onclose = () => onClose();

  websocket.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && messageRequests.has(msg.id)) {
      const { resolve } = messageRequests.get(msg.id);
      resolve(msg);
      // Without an `id` we treat as a broadcast message that
      // was sent from the server without a request from the client
    } else {
      if (!(await onBroadcastMessage(msg))) {
        console.error(
          "websocket client received a message it could not handle: ",
          msg
        );
      }
    }
  };

  // Wrap a websocket request in a promise that expects
  // a response from the server
  function request(message) {
    const id = ++messageId;
    const resolve = (data) => data;
    const reject = (e) => {};
    const p = new Promise(function (resolve, reject) {
      messageRequests.set(id, { resolve, reject });
    });
    message.id = id;
    websocket.send(JSON.stringify(message));
    return p;
  }

  return {
    websocket,
    request,
  };
};
