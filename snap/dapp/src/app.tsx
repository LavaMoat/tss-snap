import React, {useEffect, useState} from "react";

import init, {encrypt, decrypt} from '@metamask/mpc-snap-wasm';
import {useDispatch, useSelector} from 'react-redux';
import {loadPrivateKey, setState, getState} from './store/keys';
import snapId from './snap-id';

export default function App() {
  const dispatch = useDispatch();
  const [ready, setReady] = useState(false);

  //const {privateKey} = useSelector(keySelector);

  useEffect(() => {
    const initialize = async () => {
      // Setup the wasm helpers
      await init();
      setReady(true);
    }
    initialize();
  }, []);

  async function connect () {
    try {
      await ethereum.request({
        method: 'wallet_enable',
        params: [{
          wallet_snap: { [snapId]: {} },
        }]
      })
      await dispatch(loadPrivateKey());

      const state = await dispatch(getState());
      console.log(state);
    } catch(e) {
      // TODO: handle snap connect failure.
      console.error(e);
    }
  }

  /*
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
  */

  /*
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
  */

  /*
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
  */

  if (ready === false) {
    return null;
  }

  //<button onClick={setState}>Set State</button>
      //<button onClick={getState}>Get State</button>
      //<button onClick={getKey}>Get Key</button>
      //<p>{key.privateKey}</p>

  return (
    <>
      <button onClick={connect}>Connect</button>
    </>
  );
}
