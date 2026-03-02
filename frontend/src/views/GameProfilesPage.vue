<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";

import api from "../api";

const loading = ref(false);
const errorText = ref("");
const search = ref("");

const payload = reactive({
  can_write: false,
  profiles: [],
  participantsWithoutProfile: [],
  objects: [],
});

const createForm = reactive({
  participant_id: "",
  hero_name: "",
  level: 1,
});

const quickForm = reactive({
  profile_id: "",
  object_id: "",
  quantity: 1,
});

const objectForm = reactive({
  name: "",
  object_type: "LOOT",
  price: 0,
  parameters: "",
});

function setError(error, fallback) {
  errorText.value = error.response?.data?.detail || fallback;
}

async function loadProfiles() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/game-profiles/bootstrap", {
      params: search.value.trim() ? { query: search.value.trim() } : {},
    });
    const data = response.data?.данные || {};
    payload.can_write = Boolean(data.can_write);
    payload.profiles = data.профиля || [];
    payload.participantsWithoutProfile = data.подростки_без_профиля || [];
    payload.objects = data.игровые_объекты || [];
  } catch (error) {
    setError(error, "Не удалось загрузить игровые профиля.");
  } finally {
    loading.value = false;
  }
}

async function createProfile() {
  if (!payload.can_write) return;
  try {
    await api.post("/game-profiles", {
      participant_id: Number(createForm.participant_id),
      hero_name: createForm.hero_name.trim(),
      level: Number(createForm.level) || 1,
    });
    createForm.participant_id = "";
    createForm.hero_name = "";
    createForm.level = 1;
    await loadProfiles();
  } catch (error) {
    setError(error, "Не удалось создать игровой профиль.");
  }
}

async function saveProfile(row) {
  if (!payload.can_write) return;
  try {
    await api.patch(`/game-profiles/${row.id}`, {
      participant_id: Number(row.participant_id),
      hero_name: row.герой,
      level: Number(row.уровень) || 1,
    });
    await loadProfiles();
  } catch (error) {
    setError(error, "Не удалось сохранить игровой профиль.");
  }
}

async function applyQuick() {
  if (!payload.can_write) return;
  try {
    await api.post(`/game-profiles/${Number(quickForm.profile_id)}/quick-action`, {
      object_id: Number(quickForm.object_id),
      quantity: Number(quickForm.quantity) || 1,
    });
    quickForm.quantity = 1;
    await loadProfiles();
  } catch (error) {
    setError(error, "Не удалось выполнить быстрое начисление.");
  }
}

async function createObject() {
  if (!payload.can_write) return;
  try {
    await api.post("/game-objects", {
      name: objectForm.name.trim(),
      object_type: objectForm.object_type,
      price: Number(objectForm.price) || 0,
      parameters: objectForm.parameters.trim() || null,
    });
    objectForm.name = "";
    objectForm.object_type = "LOOT";
    objectForm.price = 0;
    objectForm.parameters = "";
    await loadProfiles();
  } catch (error) {
    setError(error, "Не удалось добавить игровой объект.");
  }
}

async function saveObject(row) {
  if (!payload.can_write) return;
  try {
    await api.patch(`/game-objects/${row.id}`, {
      name: row.название,
      object_type: row.тип,
      price: Number(row.цена) || 0,
      parameters: row.параметры || null,
    });
    await loadProfiles();
  } catch (error) {
    setError(error, "Не удалось обновить игровой объект.");
  }
}

async function deleteObject(objectId) {
  if (!payload.can_write) return;
  try {
    await api.delete(`/game-objects/${objectId}`);
    await loadProfiles();
  } catch (error) {
    setError(error, "Не удалось удалить игровой объект.");
  }
}

onMounted(loadProfiles);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Игровые профиля</h1>
      <p class="mt-2 text-sm text-slate-600">
        Быстрый режим начислений: выбирайте профиль, предмет и количество.
      </p>
    </header>

    <div class="card flex flex-wrap items-center gap-2">
      <input v-model="search" class="field max-w-xl" placeholder="Поиск по герою или ФИО" />
      <button class="secondary-btn" @click="loadProfiles">Найти</button>
      <span class="ml-auto rounded-full border border-slate-300 px-3 py-1 text-xs">
        Режим: {{ payload.can_write ? "Запись" : "Чтение" }}
      </span>
    </div>

    <p v-if="loading" class="text-sm text-slate-500">Загрузка...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <article class="card space-y-3">
      <h2 class="text-lg font-semibold">Быстрые действия</h2>
      <div class="grid gap-2 md:grid-cols-4">
        <select v-model="quickForm.profile_id" class="field">
          <option value="">Игровой профиль</option>
          <option v-for="item in payload.profiles" :key="item.id" :value="item.id">
            {{ item.фио }} · {{ item.герой }}
          </option>
        </select>
        <select v-model="quickForm.object_id" class="field">
          <option value="">Предмет/ачивка</option>
          <option v-for="item in payload.objects" :key="item.id" :value="item.id">
            {{ item.название }} ({{ item.тип }}, {{ item.цена }})
          </option>
        </select>
        <input v-model="quickForm.quantity" class="field" type="number" min="1" />
        <button class="primary-btn" :disabled="!payload.can_write" @click="applyQuick">Применить</button>
      </div>
      <p class="text-xs text-slate-500">
        Золото рассчитывается автоматически: floor(цена / 2) × количество.
      </p>
    </article>

    <article class="card space-y-3">
      <h2 class="text-lg font-semibold">Создать игровой профиль</h2>
      <div class="grid gap-2 md:grid-cols-4">
        <select v-model="createForm.participant_id" class="field">
          <option value="">Подросток без профиля</option>
          <option v-for="item in payload.participantsWithoutProfile" :key="item.id" :value="item.id">
            {{ item.фио }}
          </option>
        </select>
        <input v-model="createForm.hero_name" class="field" placeholder="Игровое имя" />
        <input v-model="createForm.level" class="field" type="number" min="1" />
        <button class="primary-btn" :disabled="!payload.can_write" @click="createProfile">Создать</button>
      </div>
    </article>

    <article class="card space-y-3">
      <h2 class="text-lg font-semibold">Таблица игровых профилей</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2">ФИО</th>
              <th class="p-2">Игровое имя</th>
              <th class="p-2">Уровень</th>
              <th class="p-2">Лут</th>
              <th class="p-2">Ачивки</th>
              <th class="p-2">Золото</th>
              <th class="p-2">Карточка</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.profiles" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">{{ row.фио }}</td>
              <td class="p-2">
                <input v-model="row.герой" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <input
                  v-model="row.уровень"
                  class="field !min-h-9 !py-1 text-xs"
                  type="number"
                  :disabled="!payload.can_write"
                />
              </td>
              <td class="p-2">{{ row.лут }}</td>
              <td class="p-2">{{ row.ачивки }}</td>
              <td class="p-2">{{ row.золото }}</td>
              <td class="p-2">
                <RouterLink class="text-sky-700 underline" :to="`/profile/participant/${row.participant_id}`">Открыть</RouterLink>
              </td>
              <td class="p-2">
                <button class="secondary-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="saveProfile(row)">
                  Сохранить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <article class="card space-y-3">
      <h2 class="text-lg font-semibold">Лут и ачивки</h2>
      <div class="grid gap-2 md:grid-cols-5">
        <input v-model="objectForm.name" class="field" placeholder="Название" />
        <select v-model="objectForm.object_type" class="field">
          <option value="LOOT">LOOT</option>
          <option value="ACHIEVEMENT">ACHIEVEMENT</option>
          <option value="GEAR">GEAR</option>
        </select>
        <input v-model="objectForm.price" class="field" type="number" min="0" placeholder="Цена" />
        <input v-model="objectForm.parameters" class="field" placeholder="Параметры" />
        <button class="primary-btn" :disabled="!payload.can_write" @click="createObject">Добавить</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2">Название</th>
              <th class="p-2">Тип</th>
              <th class="p-2">Цена</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.objects" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">
                <input v-model="row.название" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <select v-model="row.тип" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write">
                  <option value="LOOT">LOOT</option>
                  <option value="ACHIEVEMENT">ACHIEVEMENT</option>
                  <option value="GEAR">GEAR</option>
                </select>
              </td>
              <td class="p-2">
                <input
                  v-model="row.цена"
                  class="field !min-h-9 !py-1 text-xs"
                  type="number"
                  min="0"
                  :disabled="!payload.can_write"
                />
              </td>
              <td class="p-2">
                <div class="flex gap-1">
                  <button class="secondary-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="saveObject(row)">
                    Сохранить
                  </button>
                  <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="deleteObject(row.id)">
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>

