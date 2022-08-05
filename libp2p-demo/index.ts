import { createLibp2p, Libp2pNode } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { WebRTCStar } from '@libp2p/webrtc-star'
import { peerIdFromString } from '@libp2p/peer-id'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { Bootstrap } from '@libp2p/bootstrap'
import { GossipSub } from '@chainsafe/libp2p-gossipsub'

import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'

const topic = 'broadcast'

async function makeHost(): Libp2pNode {
  const transportKey = WebRTCStar.prototype[Symbol.toStringTag];

  console.log(transportKey);

  const webRtcStar = new WebRTCStar()

  const host = await createLibp2p({
    addresses: {
      listen: [
        //'/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
        //'/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'
        '/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star',
      ]
    },
    transports: [
      new WebSockets(),
      webRtcStar
    ],
    connectionEncryption: [new Noise()],
    streamMuxers: [new Mplex()],
    peerDiscovery: [
      webRtcStar.discovery,
    ],
    connectionManager: {
      maxParallelDials: 150, // 150 total parallel multiaddr dials
      maxDialsPerPeer: 4, // Allow 4 multiaddrs to be dialed per peer in parallel
      dialTimeout: 10e3, // 10 second dial timeout per peer dial
      autoDial: true
    },
    /*
    nat: {
      enabled: false
    },
    */
    pubsub: new GossipSub({emitSelf: false}),

    /*
    config: {
      transport: {
        [transportKey]: {
          listenerOptions: {
            config: {
              iceServers: [
                { 'urls': 'stun:stun.l.google.com:19302' },
                {
                  "urls": ["turn:127.0.0.1:3478"],
                  "username": "test",
                  "credential": "password"
                },
              ]
            }
          }
        }
      }
    }
    */

  })

  // Listen for new peers
  host.addEventListener('peer:discovery', async (evt) => {
    const peer = evt.detail
    console.log(`Peer discovery ${peer.id.toString()}`)
    console.log(peer)
    console.log(peer.multiaddrs.toString())

    /*
    const { remotePeer, remoteAddr } = peer;

    console.log("remoteAddr", remoteAddr.toString());

    const peerId = peerIdFromString(remotePeer.toString())
    */

    //console.log('connect', peerId.toString());

    //console.log(host.dial.toString())
    //
    /*

        peerConnectionConfig: {
          iceServers: [
            { 'urls': 'stun:stun.l.google.com:19302' },
            {
              "urls": ["turn:127.0.0.1:3478"],
              "username": "test",
              "credential": "password"
            },
          ]
        }
    */

    await host.peerStore.addressBook.set(peer.id, peer.multiaddrs);
    const conn = await host.dial(peer.id);

    console.log('conn', conn)

    const stream = await conn.newStream(["/pubsub/1.0.0"]);

    console.log('stream', stream)
    console.log(`Connected to ${remotePeer.toString()}`)
  })

  // Listen for new connections to peers
  host.connectionManager.addEventListener('peer:connect', async (evt) => {
    const connection = evt.detail
  })

  // Listen for peers disconnecting
  host.connectionManager.addEventListener('peer:disconnect', (evt) => {
    const connection = evt.detail
    console.log(`Disconnected from ${connection.remotePeer.toString()}`)
  })

  return host
}

document.addEventListener('DOMContentLoaded', async () => {
  const host = await makeHost();
  await host.start()

  console.log(host);
  console.log(`host id is ${host.peerId.toString()}`)

  host.pubsub.addEventListener('message', (evt) => {
    const connection = evt.detail;
    const { data } = connection;
    const value = new TextDecoder().decode(data);
    console.log("got incoming gossip message", evt);
    console.log("got incoming gossip message", value);
  })

  host.pubsub.subscribe(topic)

  /*
  setInterval(async () => {

    console.log(host.pubsub.started)
    console.log(host.pubsub.getPeers())
    console.log(host.pubsub.getSubscribers(topic))

    const value = new TextEncoder().encode("test message");
    const amount = await host.pubsub.publish(topic, value)
    console.log("published to ", amount);
  }, 1000)
  */

})
