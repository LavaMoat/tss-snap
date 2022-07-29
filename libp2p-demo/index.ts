import { createLibp2p, Libp2pNode } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { WebRTCStar } from '@libp2p/webrtc-star'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { Bootstrap } from '@libp2p/bootstrap'
import { GossipSub } from '@chainsafe/libp2p-gossipsub'

import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'

const topic = 'broadcast'

async function makeHost(listen?: string[]): Libp2pNode {
  const webRtcStar = new WebRTCStar()

  const host = await createLibp2p({
    addresses: {
      listen: listen || [
        //'/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
        //'/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'
        '/dns4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star',
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
  })

  // Listen for new peers
  host.addEventListener('peer:discovery', (evt) => {
    const peer = evt.detail
    //console.log(`Found peer ${peer.id.toString()}`)
  })

  // Listen for new connections to peers
  host.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log(`Connected to ${connection.remotePeer.toString()}`)
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

  const pubsub = new GossipSub();
  await pubsub.init(host.components);
  await pubsub.start()
  /*
  pubsub.on(topic, (msg) => {
    console.log(`${id} received: ${toString(msg.data)}`)
  })
  */
  pubsub.subscribe(topic)

  setInterval(async () => {
    const value = new TextEncoder().encode("test message");
    await pubsub.publish(topic, value)
  }, 1000)

})
