import { clearThread, clearUnread, prependOlder, setThread } from "@/redux/chatSlice";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

const PAGE_SIZE = 30;

/**
 * Loads the open thread for auth.selectedUser and exposes cursor pagination.
 * The server marks the counterpart's messages as read on fetch (and emits
 * "messagesRead" to them), so we also zero the local unread badge.
 *
 * Returns { loading, loadingOlder, loadOlder } — call loadOlder() when the
 * user scrolls to the top; it resolves to the number of messages prepended.
 */
const useGetAllMessage = () => {
  const dispatch = useDispatch();
  const { selectedUser } = useSelector((store) => store.auth);
  const { prevCursor } = useSelector((store) => store.chat);
  // Starts true: the component only mounts with a thread selected, and the
  // fetch effect fires immediately — avoids a one-frame empty-thread flash.
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedUser?._id || null;

  useEffect(() => {
    const id = selectedUser?._id;
    dispatch(clearThread());
    if (!id) return;
    let cancelled = false;
    const fetchThread = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `/api/v1/message/all/${id}?limit=${PAGE_SIZE}`,
          { withCredentials: true }
        );
        if (!cancelled && response.data.success) {
          dispatch(setThread({
            messages: response.data.messages,
            prevCursor: response.data.prevCursor ?? null,
          }));
          dispatch(clearUnread(id));
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.response?.data?.message || "Could not load messages");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchThread();
    return () => { cancelled = true; };
  }, [selectedUser?._id, dispatch]);

  const loadOlder = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id || !prevCursor || loadingOlder) return 0;
    setLoadingOlder(true);
    try {
      const response = await axios.get(
        `/api/v1/message/all/${id}?limit=${PAGE_SIZE}&before=${prevCursor}`,
        { withCredentials: true }
      );
      // Thread switched while the request was in flight — drop the page.
      if (selectedIdRef.current !== id) return 0;
      if (response.data.success) {
        dispatch(prependOlder({
          messages: response.data.messages,
          prevCursor: response.data.prevCursor ?? null,
        }));
        return response.data.messages?.length || 0;
      }
      return 0;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load older messages");
      return 0;
    } finally {
      setLoadingOlder(false);
    }
  }, [prevCursor, loadingOlder, dispatch]);

  return { loading, loadingOlder, loadOlder, hasMore: !!prevCursor };
};

export default useGetAllMessage;
