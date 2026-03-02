<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";

import api from "../api";
import { clearSession, sessionState, setSession } from "../session";

const route = useRoute();
const router = useRouter();
const mobileOpen = ref(false);
const greetingText = ref("");
const loadingNav = ref(false);
const navError = ref("");
const navItems = ref([]);

const userName = computed(() => sessionState.user?.фио || "Пользователь");
const roleName = computed(() => sessionState.user?.роль || "Неизвестно");

const fallbackTabs = [
  { key: "admin", название: "Администрирование", route: "/admin", access: "READ" },
  { key: "people", название: "Люди", route: "/people", access: "READ" },
  { key: "game_profiles", название: "Игровые профиля", route: "/game-profiles", access: "READ" },
  { key: "games", название: "Игры", route: "/games", access: "READ" },
];

function accessBadge(access) {
  if (access === "WRITE") return "Запись";
  if (access === "READ") return "Чтение";
  return access || "—";
}

async function loadMeIfNeeded() {
  if (!sessionState.token || sessionState.user) {
    return;
  }
  try {
    const response = await api.get("/auth/me");
    const user = response.data?.данные;
    if (user) {
      setSession(sessionState.token, user);
    }
  } catch (_error) {
    clearSession();
    await router.push("/login");
  }
}

async function loadNavigation() {
  loadingNav.value = true;
  navError.value = "";
  try {
    await loadMeIfNeeded();
    const response = await api.get("/ui/navigation");
    const data = response.data?.данные || {};
    navItems.value = Array.isArray(data.вкладки) ? data.вкладки : [];
    greetingText.value = data.приветствие || `Привет, ${userName.value}. Ваша роль: ${roleName.value}`;
  } catch (error) {
    navItems.value = fallbackTabs;
    greetingText.value = `Привет, ${userName.value}. Ваша роль: ${roleName.value}`;
    navError.value = error.response?.data?.detail || "Не удалось загрузить навигацию.";
    if (error.response?.status === 401) {
      clearSession();
      await router.push("/login");
    }
  } finally {
    loadingNav.value = false;
  }
}

async function logout() {
  clearSession();
  mobileOpen.value = false;
  await router.push("/login");
}

onMounted(loadNavigation);
watch(
  () => sessionState.user,
  () => {
    if (!greetingText.value && sessionState.user) {
      greetingText.value = `Привет, ${userName.value}. Ваша роль: ${roleName.value}`;
    }
  },
);
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold">
            {{ userName }}
          </p>
          <p class="truncate text-xs text-slate-600">Ваша роль: {{ roleName }}</p>
        </div>
        <button class="secondary-btn !px-3" @click="mobileOpen = !mobileOpen">
          {{ mobileOpen ? "Закрыть" : "Меню" }}
        </button>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[1500px]">
      <aside
        class="fixed inset-y-0 left-0 z-40 w-80 border-r border-slate-200 bg-white p-4 shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none"
        :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="card mb-4">
          <p class="text-sm font-semibold">
            {{ greetingText || `Привет, ${userName}. Ваша роль: ${roleName}` }}
          </p>
        </div>

        <p v-if="loadingNav" class="mb-2 text-xs text-slate-500">Загрузка навигации...</p>
        <p
          v-if="navError"
          class="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700"
        >
          {{ navError }}
        </p>

        <nav class="space-y-1">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="flex w-full min-h-11 items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium"
            :class="
              route.path.startsWith(item.route)
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            "
            @click="
              () => {
                mobileOpen = false;
                router.push(item.route);
              }
            "
          >
            <span>{{ item.название }}</span>
            <span class="text-[10px] opacity-80">{{ accessBadge(item.access) }}</span>
          </button>
        </nav>

        <button class="secondary-btn mt-4 w-full" @click="logout">Выйти</button>
      </aside>

      <main class="w-full p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

