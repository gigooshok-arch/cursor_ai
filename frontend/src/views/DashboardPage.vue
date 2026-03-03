<script setup>
import { onMounted, ref } from "vue";

import api from "../api";
import { sessionState } from "../session";

const summary = ref(null);
const loading = ref(false);
const errorText = ref("");

async function loadSummary() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/dashboard/summary");
    summary.value = response.data?.данные || null;
  } catch (error) {
    errorText.value = error.response?.data?.detail || "Не удалось загрузить сводку.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadSummary);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Главная</h1>
      <p class="mt-2 text-sm text-slate-600">
        Привет, {{ sessionState.user?.фио }}. Система адаптирована для ПК, планшета и телефона в локальной сети.
      </p>
    </header>

    <p v-if="loading" class="text-sm text-slate-500">Загружаем сводку...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <div v-if="summary" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="card">
        <p class="text-sm text-slate-600">Участники</p>
        <p class="mt-2 text-3xl font-bold">{{ summary.участники }}</p>
      </article>
      <article class="card">
        <p class="text-sm text-slate-600">Сотрудники</p>
        <p class="mt-2 text-3xl font-bold">{{ summary.сотрудники }}</p>
      </article>
      <article class="card">
        <p class="text-sm text-slate-600">Родственники</p>
        <p class="mt-2 text-3xl font-bold">{{ summary.родственники }}</p>
      </article>
      <article class="card">
        <p class="text-sm text-slate-600">Игры</p>
        <p class="mt-2 text-3xl font-bold">{{ summary.игры }}</p>
      </article>
    </div>

    <article v-if="summary" class="card text-sm">
      <p>
        Ваша роль: <strong>{{ summary.моя_роль }}</strong>
      </p>
      <p class="mt-1">
        Доступ к редактированию карточек:
        <strong>{{ summary.доступ_на_изменение_профиля ? "Разрешен" : "Только чтение" }}</strong>
      </p>
    </article>
  </section>
</template>

