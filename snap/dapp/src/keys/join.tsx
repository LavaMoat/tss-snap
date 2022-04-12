import React from 'react';

import {useParams} from 'react-router-dom';

export default function Join() {
  const {group, session} = useParams();

  return <p>Join screen {group} / {session}</p>
}
