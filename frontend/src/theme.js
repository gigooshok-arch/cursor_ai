import { computed, reactive } from "vue";

const STORAGE_KEY = "erp_rassvet_theme";

export const themeState = reactive({
  mode: "light",
});

function applyTheme(mode) {
  const dark = mode === "dark";
  document.body.classList.toggle("theme-dark", dark);
}

export function setTheme(mode) {
  themeState.mode = mode === "dark" ? "dark" : "light";
  applyTheme(themeState.mode);
  localStorage.setItem(STORAGE_KEY, themeState.mode);
}

export function toggleTheme() {
  setTheme(themeState.mode === "dark" ? "light" : "dark");
}

export function initTheme() {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage === "dark" || fromStorage === "light") {
    setTheme(fromStorage);
    return;
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  setTheme(prefersDark ? "dark" : "light");
}

export const themeToggleLabel = computed(() =>
  themeState.mode === "dark" ? "Светлая тема" : "Темная тема",
);

