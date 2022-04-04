import React, {useState} from "react";

export default function App() {
  const snapId = `local:${location.href}`;

  const [stateValue, setStateValue] = useState({mock: 42});

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

  async function getState() {
    try {
      const response = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'getState'
        }]
      })

      console.log("get state", response);
    } catch (err) {
      console.error(err)
      alert('Problem happened: ' + err.message || err)
    }
  }

  async function setState() {
    const text = document.getElementById('state-value');
    const state = JSON.parse(text.value);
    try {
      const response = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'updateState',
          params: state,
        }]
      })

      console.log("set state", response);
    } catch (err) {
      console.error(err)
      alert('Problem happened: ' + err.message || err)
    }
  }

  async function getKey() {
    try {
      const response = await ethereum.request({
        method: 'wallet_invokeSnap',
        params: [snapId, {
          method: 'getKey',
        }]
      })

      console.log("got key data", response);
      console.log("got key ", atob(response.key));
    } catch (err) {
      console.error(err)
      alert('Problem happened: ' + err.message || err)
    }
  }

  let value = {"mock": 42};

  return (
    <>
      <button onClick={connect}>Connect</button>
      <button onClick={getState}>Get State</button>
      <textarea id="state-value" rows="4" onChange={(e) => setStateValue(e.target.value)} value={JSON.stringify(stateValue)}></textarea>
      <button onClick={setState}>Set State</button>
      <button onClick={getKey}>Get Key</button>
    </>
  );
}
