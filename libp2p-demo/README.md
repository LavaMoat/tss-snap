# Libp2p MPC Demo

To get started run a local `webrtc-star` signalling service:

```
webrtc-star --host=127.0.0.1
```

Which will start the signalling server on the default port of `9090`, see the [webrtc-star-signalling-server package](https://github.com/libp2p/js-libp2p-webrtc-star/tree/master/packages/webrtc-star-signalling-server) for more information.

Note that if you are installing the server locally on an M1 you may need to remove the Electron dependency and switch the `webrtc` dependency to `@koush/wrtc`.

Now you can start some nodes in different terminal sessions run:

```
npm start
```

And navigate to the dev servers, for example:

```
http://localhost:3000
http://localhost:3001
```
