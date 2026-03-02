<script setup>
import { computed, onMounted, reactive, ref } from "vue";

import api from "../api";

const loading = ref(false);
const errorText = ref("");
const previewGold = ref(null);

const payload = reactive({
  can_write: false,
  games: [],
  masters: [],
  participants: [],
  objects: [],
});

const form = reactive({
  activity_name: "",
  game_date: "",
  master_employee_id: "",
  participant_ids: new Set(),
  loot_object_id: "",
  loot_quantity: 1,
  description: "",
});

const objectForm = reactive({
  name: "",
  object_type: "LOOT",
  price: 0,
  parameters: "",
});

const participantCount = computed(() => form.participant_ids.size);

function setError(error, fallback) {
  errorText.value = error.response?.data?.detail || fallback;
}

function todayIsoDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toggleParticipant(id, checked) {
  if (checked) {
    form.participant_ids.add(id);
  } else {
    form.participant_ids.delete(id);
  }
  form.participant_ids = new Set(form.participant_ids);
}

async function loadGames() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/games/bootstrap");
    const data = response.data?.данные || {};
    payload.can_write = Boolean(data.can_write);
    payload.games = data.игры || [];
    payload.masters = data.мастера || [];
    payload.participants = data.подростки || [];
    payload.objects = data.игровые_объекты || [];
    if (!form.game_date) {
      form.game_date = todayIsoDate();
    }
  } catch (error) {
    setError(error, "Не удалось загрузить игры.");
  } finally {
    loading.value = false;
  }
}

async function updatePreview() {
  previewGold.value = null;
  if (!form.loot_object_id) return;
  const objectRow = payload.objects.find((item) => item.id === Number(form.loot_object_id));
  if (!objectRow) return;
  try {
    const response = await api.post("/games/preview-gold", {
      price: Number(objectRow.цена) || 0,
      quantity: Number(form.loot_quantity) || 1,
    });
    previewGold.value = response.data?.данные?.золото ?? null;
  } catch (_error) {
    previewGold.value = null;
  }
}

async function createGame() {
  if (!payload.can_write) return;
  try {
    await api.post("/games", {
      activity_name: form.activity_name.trim(),
      game_date: form.game_date || null,
      master_employee_id: Number(form.master_employee_id),
      participant_ids: Array.from(form.participant_ids),
      loot_object_id: form.loot_object_id ? Number(form.loot_object_id) : null,
      loot_quantity: Number(form.loot_quantity) || 1,
      description: form.description.trim() || null,
    });
    form.activity_name = "";
    form.game_date = todayIsoDate();
    form.master_employee_id = "";
    form.participant_ids = new Set();
    form.loot_object_id = "";
    form.loot_quantity = 1;
    form.description = "";
    previewGold.value = null;
    await loadGames();
  } catch (error) {
    setError(error, "Не удалось создать игру.");
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
    await loadGames();
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
    await loadGames();
  } catch (error) {
    setError(error, "Не удалось обновить игровой объект.");
  }
}

async function deleteObject(id) {
  if (!payload.can_write) return;
  try {
    await api.delete(`/game-objects/${id}`);
    await loadGames();
  } catch (error) {
    setError(error, "Не удалось удалить игровой объект.");
  }
}

onMounted(loadGames);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Игры</h1>
      <p class="mt-2 text-sm text-slate-600">
        Журнал прошедших игр и мастер создания новой игры.
      </p>
    </header>

    <p v-if="loading" class="text-sm text-slate-500">Загрузка...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <article class="card space-y-3">
      <h2 class="text-lg font-semibold">Создать игру</h2>
      <div class="grid gap-2 xl:grid-cols-4">
        <input v-model="form.activity_name" class="field" placeholder="Название игры" />
        <input v-model="form.game_date" class="field" type="date" />
        <select v-model="form.master_employee_id" class="field">
          <option value="">Мастер</option>
          <option v-for="item in payload.masters" :key="item.id" :value="item.id">{{ item.фио }}</option>
        </select>
        <textarea
          v-model="form.description"
          class="field !min-h-20 xl:col-span-4"
          placeholder="Описание (необязательно)"
        />
      </div>

      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="mb-2 text-sm font-semibold">Участники ({{ participantCount }})</p>
        <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <label
            v-for="item in payload.participants"
            :key="item.id"
            class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
          >
            <input
              type="checkbox"
              :checked="form.participant_ids.has(item.id)"
              @change="toggleParticipant(item.id, $event.target.checked)"
            />
            <span>{{ item.фио }}</span>
          </label>
        </div>
      </div>

      <div class="grid gap-2 md:grid-cols-4">
        <select v-model="form.loot_object_id" class="field" @change="updatePreview">
          <option value="">Лут/ачивка (необязательно)</option>
          <option v-for="item in payload.objects" :key="item.id" :value="item.id">
            {{ item.название }} ({{ item.цена }})
          </option>
        </select>
        <input v-model="form.loot_quantity" class="field" type="number" min="1" @input="updatePreview" />
        <div class="flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm">
          Золото по формуле: <strong class="ml-1">{{ previewGold ?? "—" }}</strong>
        </div>
        <button class="primary-btn" :disabled="!payload.can_write" @click="createGame">Создать игру</button>
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

    <article class="card space-y-3">
      <h2 class="text-lg font-semibold">История игр</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2">Дата игры</th>
              <th class="p-2">Название игры</th>
              <th class="p-2">Мастер</th>
              <th class="p-2">Участников</th>
              <th class="p-2">Золото</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.games" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">{{ row.дата_игры }}</td>
              <td class="p-2">{{ row.активность }}</td>
              <td class="p-2">{{ row.мастер }}</td>
              <td class="p-2">{{ row.количество_участников }}</td>
              <td class="p-2">{{ row.золото_распределено }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>

