import { setMessages } from "@/redux/chatSlice";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

const useGetRTM = () => {
  const dispatch = useDispatch();
  const { socket } = useSelector((store) => store.socketio);

  // Subscribe once per socket. Reading current messages via getState inside a
  // thunk avoids re-subscribing on every incoming message (the old [messages]
  // dependency re-registered the listener each time).
  useEffect(() => {
    if (!socket) return;
    const handler = (newMessage) => {
      dispatch((d, getState) => {
        d(setMessages([...getState().chat.messages, newMessage]));
      });
    };
    socket.on("newMessage", handler);
    return () => {
      socket.off("newMessage", handler);
    };
  }, [socket, dispatch]);
};

export default useGetRTM;
