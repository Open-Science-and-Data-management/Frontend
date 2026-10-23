import {
  adoptThread,
  appendThreadEntry,
  clearThreadChat,
  listThread,
  updateThreadEntry,
} from "@/api/mock/threadServer";

export type { ThreadPage } from "@/api/mock/threadServer";
export { THREAD_PAGE_SIZE } from "@/api/mock/threadServer";

/**
 * The plan's AI thread as the server keeps it. The client holds a cache of
 * what it has loaded and writes every change through; the server is the
 * record. Swapping the mock for HTTP calls changes this file only.
 */
export const aiThreadApi = {
  list: listThread,
  append: appendThreadEntry,
  update: updateThreadEntry,
  clear: clearThreadChat,
  adopt: adoptThread,
};
