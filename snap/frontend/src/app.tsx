import React from "react";

export default function App() {
  const snapId = `local:${window.location.href}`;

  async function connect () {
    try {
      await ethereum.request({
        method: 'wallet_enable',
        params: [{
          wallet_snap: { [snapId]: {} },
        }]
      })
    } catch(e) {
      // TODO: handle snap connect failure.
      console.error(e);
    }
  }

  return (
    <button onClick={connect}>Connect</button>
  );
}
