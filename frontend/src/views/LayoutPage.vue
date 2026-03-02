<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import api from "../api";
import { clearSession, sessionState, setSession } from "../session";

const route = useRoute();
const router = useRouter();
const mobileOpen = ref(false);
const loadingMe = ref(false);
const errorText = ref("");

const navItems = computed(() => [
  { label: "Главная", to: "/dashboard" },
  { label: "Карточки пользователей", to: "/profiles" },
]);

const userName = computed(() => sessionState.user?.фио || "Пользователь");
const roleName = computed(() => sessionState.user?.роль || "Неизвестно");

async function loadCurrentUser() {
  if (!sessionState.token || sessionState.user) {
    return;
  }
  loadingMe.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/auth/me");
    const user = response.data?.данные;
    if (user) {
      setSession(sessionState.token, user);
    }
  } catch (error) {
    errorText.value = error.response?.data?.detail || "Не удалось получить профиль.";
    clearSession();
    await router.push("/login");
  } finally {
    loadingMe.value = false;
  }
}

async function logout() {
  clearSession();
  mobileOpen.value = false;
  await router.push("/login");
}

onMounted(loadCurrentUser);
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold">{{ userName }}</p>
          <p class="truncate text-xs text-slate-600">Роль: {{ roleName }}</p>
        </div>
        <button class="secondary-btn !px-3" @click="mobileOpen = !mobileOpen">
          {{ mobileOpen ? "Закрыть" : "Меню" }}
        </button>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[1400px]">
      <aside
        class="fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white p-4 shadow-xl transition-transform md:static md:translate-x-0 md:shadow-none"
        :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="card mb-4">
          <p class="text-sm font-semibold">{{ userName }}</p>
          <p class="text-xs text-slate-600">Роль: {{ roleName }}</p>
          <p class="mt-1 text-xs text-slate-500">Локальная сеть: erp-rassvet28.ru</p>
        </div>

        <nav class="space-y-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="block min-h-11 rounded-lg px-3 py-2 text-sm font-medium"
            :class="
              route.path.startsWith(item.to)
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            "
            @click="mobileOpen = false"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <button class="secondary-btn mt-4 w-full" @click="logout">Выйти</button>
      </aside>

      <main class="w-full p-4 md:p-6">
        <p v-if="loadingMe" class="mb-3 text-sm text-slate-500">Проверка сессии...</p>
        <p v-if="errorText" class="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {{ errorText }}
        </p>
        <RouterView />
      </main>
    </div>
  </div>
</template>

