import { useEffect, useState } from "react";
import { getSocket, onSocketChange } from "@/lib/socket";

// React hook over the module-level socket singleton — re-renders consumers
// when the socket connects/disconnects.
const useSocket = () => {
  const [socket, setSocket] = useState(getSocket);
  useEffect(() => onSocketChange(setSocket), []);
  return socket;
};

export default useSocket;
