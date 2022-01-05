import React from "react";
import { useParams } from "react-router-dom";

const Sign = () => {
  const params = useParams();
  const { address } = params;
  return <p>Sign using wallet connect view {address}</p>;
};

export default Sign;
