import { getStore } from "@netlify/blobs";
import { SEARCHED_USERS_STORE, createSearchedUserHandler } from "../lib/searched-users.js";

const searchedUserHandler = createSearchedUserHandler({
  getStore: () => getStore(SEARCHED_USERS_STORE),
});

export default searchedUserHandler;
