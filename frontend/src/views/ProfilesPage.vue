<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import api from "../api";

const query = ref("");
const loading = ref(false);
const errorText = ref("");
const profiles = ref({
  участники: [],
  сотрудники: [],
  родственники: [],
});

function resolveRoute(link) {
  const [_, profileWord, entityType, id] = link.split("/");
  if (profileWord !== "profile") {
    return { path: "/profiles" };
  }
  return {
    name: "profile",
    params: { entityType, id },
  };
}

async function loadProfiles() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/profiles", {
      params: query.value.trim() ? { query: query.value.trim() } : {},
    });
    profiles.value = response.data?.данные || profiles.value;
  } catch (error) {
    errorText.value = error.response?.data?.detail || "Не удалось загрузить список профилей.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadProfiles);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Единые карточки пользователей</h1>
      <p class="mt-2 text-sm text-slate-600">
        Поиск работает по ФИО. Сортировка по умолчанию — алфавитная (А-Я).
      </p>
    </header>

    <form class="card grid gap-2 md:grid-cols-[1fr_auto]" @submit.prevent="loadProfiles">
      <input v-model="query" class="field" placeholder="Поиск по ФИО" />
      <button class="primary-btn" type="submit">Найти</button>
    </form>

    <p v-if="loading" class="text-sm text-slate-500">Загружаем профили...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <div class="grid gap-4 lg:grid-cols-3">
      <article class="card">
        <h2 class="mb-3 text-base font-semibold">Участники</h2>
        <div class="space-y-2">
          <RouterLink
            v-for="person in profiles.участники"
            :key="`participant-${person.id}`"
            :to="resolveRoute(person.ссылка)"
            class="block rounded-lg border border-slate-200 bg-slate-50 p-2"
          >
            <p class="text-sm font-semibold">{{ person.фио }}</p>
            <p class="text-xs text-slate-600">{{ person.телефон || "Телефон не указан" }}</p>
          </RouterLink>
          <p v-if="!profiles.участники.length" class="text-sm text-slate-500">Ничего не найдено.</p>
        </div>
      </article>

      <article class="card">
        <h2 class="mb-3 text-base font-semibold">Сотрудники</h2>
        <div class="space-y-2">
          <RouterLink
            v-for="person in profiles.сотрудники"
            :key="`employee-${person.id}`"
            :to="resolveRoute(person.ссылка)"
            class="block rounded-lg border border-slate-200 bg-slate-50 p-2"
          >
            <p class="text-sm font-semibold">{{ person.фио }}</p>
            <p class="text-xs text-slate-600">{{ person.телефон || "Телефон не указан" }}</p>
          </RouterLink>
          <p v-if="!profiles.сотрудники.length" class="text-sm text-slate-500">Ничего не найдено.</p>
        </div>
      </article>

      <article class="card">
        <h2 class="mb-3 text-base font-semibold">Родственники</h2>
        <div class="space-y-2">
          <RouterLink
            v-for="person in profiles.родственники"
            :key="`relative-${person.id}`"
            :to="resolveRoute(person.ссылка)"
            class="block rounded-lg border border-slate-200 bg-slate-50 p-2"
          >
            <p class="text-sm font-semibold">{{ person.фио }}</p>
            <p class="text-xs text-slate-600">{{ person.телефон || "Телефон не указан" }}</p>
          </RouterLink>
          <p v-if="!profiles.родственники.length" class="text-sm text-slate-500">Ничего не найдено.</p>
        </div>
      </article>
    </div>
  </section>
</template>

