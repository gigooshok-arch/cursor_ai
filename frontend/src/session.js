import { reactive } from "vue";

const TOKEN_KEY = "rassvet_token";
const USER_KEY = "rassvet_user";

function parseUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export const sessionState = reactive({
  token: localStorage.getItem(TOKEN_KEY),
  user: parseUser(),
});

export function setSession(token, user) {
  sessionState.token = token;
  sessionState.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionState.token = null;
  sessionState.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSessionToken() {
  return sessionState.token;
}

