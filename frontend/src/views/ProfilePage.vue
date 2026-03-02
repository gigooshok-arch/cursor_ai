<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import api from "../api";
import { sessionState } from "../session";

const route = useRoute();
const loading = ref(false);
const errorText = ref("");
const profile = ref(null);
const showEditModal = ref(false);
const saving = ref(false);
const relationSaving = ref(false);
const relationError = ref("");

const editForm = reactive({
  full_name: "",
  phone: "",
  photo: "",
  age: "",
  school: "",
  class_name: "",
  note: "",
  position: "",
});

const relationForm = reactive({
  relative_id: "",
  relation_type: "Опекун",
});

const roleCode = computed(() => sessionState.user?.код_роли || "");
const isAdmin = computed(() => roleCode.value === "ADMIN");
const isVolunteer = computed(() => roleCode.value === "VOLUNTEER");
const canEdit = computed(() => Boolean(profile.value?.доступ?.изменение));
const isParticipant = computed(() => profile.value?.entity_type === "participant");
const isEmployee = computed(() => profile.value?.entity_type === "employee");
const isRelative = computed(() => profile.value?.entity_type === "relative");

function parseProfileLink(link) {
  const parts = link.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "profile") {
    return { path: "/profiles" };
  }
  return {
    name: "profile",
    params: { entityType: parts[1], id: parts[2] },
  };
}

function syncEditForm() {
  if (!profile.value) {
    return;
  }
  editForm.full_name = profile.value.фио || "";
  editForm.phone = profile.value.телефон || "";
  editForm.photo = profile.value.фото || "";
  editForm.age = profile.value.возраст || "";
  editForm.school = profile.value.школа || "";
  editForm.class_name = profile.value.класс || "";
  editForm.note = profile.value.примечание || "";
  editForm.position = profile.value.должность || "";
}

async function loadProfile() {
  loading.value = true;
  errorText.value = "";
  relationError.value = "";
  try {
    const response = await api.get(`/profiles/${route.params.entityType}/${route.params.id}`);
    profile.value = response.data?.данные || null;
    syncEditForm();
  } catch (error) {
    errorText.value = error.response?.data?.detail || "Не удалось загрузить карточку пользователя.";
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  if (!profile.value) {
    return;
  }
  saving.value = true;
  errorText.value = "";
  try {
    const payload = {
      full_name: editForm.full_name || null,
      phone: editForm.phone || null,
      photo: editForm.photo || null,
      note: editForm.note || null,
    };

    if (isParticipant.value) {
      payload.age = editForm.age ? Number(editForm.age) : null;
      payload.school = editForm.school || null;
      payload.class_name = editForm.class_name || null;
    }
    if (isEmployee.value) {
      payload.position = editForm.position || null;
    }

    await api.patch(`/profiles/${profile.value.entity_type}/${profile.value.id}`, payload);
    showEditModal.value = false;
    await loadProfile();
  } catch (error) {
    errorText.value = error.response?.data?.detail || "Не удалось сохранить изменения.";
  } finally {
    saving.value = false;
  }
}

async function addRelation() {
  if (!isParticipant.value || !relationForm.relative_id) {
    return;
  }
  relationSaving.value = true;
  relationError.value = "";
  try {
    await api.post(`/profiles/participant/${profile.value.id}/relations`, {
      relative_id: Number(relationForm.relative_id),
      relation_type: relationForm.relation_type,
    });
    relationForm.relative_id = "";
    relationForm.relation_type = "Опекун";
    await loadProfile();
  } catch (error) {
    relationError.value = error.response?.data?.detail || "Не удалось добавить связь.";
  } finally {
    relationSaving.value = false;
  }
}

async function removeRelation(relationId) {
  if (!isParticipant.value) {
    return;
  }
  relationSaving.value = true;
  relationError.value = "";
  try {
    await api.delete(`/profiles/participant/${profile.value.id}/relations/${relationId}`);
    await loadProfile();
  } catch (error) {
    relationError.value = error.response?.data?.detail || "Не удалось удалить связь.";
  } finally {
    relationSaving.value = false;
  }
}

watch(
  () => [route.params.entityType, route.params.id],
  () => {
    loadProfile();
  },
);

onMounted(loadProfile);
</script>

<template>
  <section class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="page-title">Карточка пользователя</h1>
        <p class="mt-1 text-sm text-slate-600">
          Интеллектуальный профиль: нужные данные в нужном месте.
        </p>
      </div>
      <div class="flex gap-2">
        <RouterLink to="/profiles" class="secondary-btn">Назад к списку</RouterLink>
        <button v-if="canEdit" class="primary-btn" @click="showEditModal = true">Редактировать</button>
      </div>
    </header>

    <p v-if="loading" class="text-sm text-slate-500">Загружаем карточку...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <template v-if="profile">
      <article class="card">
        <div class="grid gap-4 md:grid-cols-[220px_1fr]">
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img
              v-if="profile.фото"
              :src="profile.фото"
              :alt="profile.фио"
              class="h-56 w-full object-cover"
            />
            <div v-else class="flex h-56 items-center justify-center text-sm text-slate-500">Фото не добавлено</div>
          </div>
          <div class="space-y-2">
            <h2 class="text-3xl font-bold">{{ profile.фио }}</h2>
            <p class="text-sm">
              <strong>Тип:</strong> {{ profile.тип }} ·
              <strong>Доступ:</strong> {{ profile.доступ?.изменение ? "Изменение" : "Чтение" }}
            </p>
            <p class="text-sm"><strong>Телефон:</strong> {{ profile.телефон || "—" }}</p>
            <p v-if="!isVolunteer && profile.школа" class="text-sm">
              <strong>Школа/класс:</strong> {{ profile.школа }} {{ profile.класс || "" }}
            </p>
            <p v-if="!isVolunteer && profile.должность" class="text-sm"><strong>Должность:</strong> {{ profile.должность }}</p>
          </div>
        </div>
      </article>

      <div v-if="isParticipant && !isVolunteer" class="grid gap-4 xl:grid-cols-2">
        <article class="card">
          <h3 class="mb-2 text-base font-semibold">
            {{ roleCode === "PEDAGOGUE" || roleCode === "DIRECTOR" ? "Срочное" : "Контакты и примечание" }}
          </h3>
          <p class="text-sm"><strong>Примечание:</strong> {{ profile.примечание || "—" }}</p>
          <div class="mt-3 space-y-2">
            <div
              v-for="relative in profile.родственники || []"
              :key="relative.id"
              class="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
            >
              <RouterLink :to="parseProfileLink(relative.ссылка)" class="font-semibold underline">
                {{ relative.фио }}
              </RouterLink>
              <p class="text-slate-600">
                {{ relative.тип_связи }} · Телефон родителя: {{ relative.телефон || "—" }}
              </p>
            </div>
          </div>
        </article>

        <article class="card">
          <h3 class="mb-2 text-base font-semibold">Игровая сводка</h3>
          <template v-if="profile.игровой_профиль">
            <p class="text-sm"><strong>Герой:</strong> {{ profile.игровой_профиль.герой }}</p>
            <div class="mt-2 flex flex-wrap gap-2 text-sm">
              <span class="rounded-full border border-slate-300 px-2 py-1">Золото: {{ profile.игровой_профиль.золото }}</span>
              <span class="rounded-full border border-slate-300 px-2 py-1">Уровень: {{ profile.игровой_профиль.уровень }}</span>
              <span class="rounded-full border border-slate-300 px-2 py-1">Лут: {{ profile.игровой_профиль.лут }}</span>
              <span class="rounded-full border border-slate-300 px-2 py-1">Ачивки: {{ profile.игровой_профиль.ачивки }}</span>
            </div>
            <div class="mt-3">
              <p class="text-sm font-semibold">Последние 3 ачивки:</p>
              <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">
                <li v-for="achievement in profile.последние_ачивки || []" :key="achievement.id">
                  {{ achievement.название }} ({{ achievement.дата }})
                </li>
              </ul>
              <p v-if="!(profile.последние_ачивки || []).length" class="text-sm text-slate-500">
                Ачивки пока не зафиксированы.
              </p>
            </div>
          </template>
          <p v-else class="text-sm text-slate-500">Игровой профиль пока не создан.</p>
        </article>
      </div>

      <article v-if="isParticipant && isVolunteer" class="card">
        <h3 class="mb-2 text-base font-semibold">Контактные данные и родственники</h3>
        <div class="space-y-2">
          <div
            v-for="relative in profile.родственники || []"
            :key="relative.id"
            class="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
          >
            <RouterLink :to="parseProfileLink(relative.ссылка)" class="font-semibold underline">
              {{ relative.фио }}
            </RouterLink>
            <p class="text-slate-600">{{ relative.тип_связи }} · {{ relative.телефон || "—" }}</p>
          </div>
        </div>
      </article>

      <article v-if="isRelative" class="card">
        <h3 class="mb-2 text-base font-semibold">Связанные участники</h3>
        <div class="space-y-2">
          <div
            v-for="linked in profile.связанные_участники || []"
            :key="linked.id"
            class="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
          >
            <RouterLink :to="parseProfileLink(linked.ссылка)" class="font-semibold underline">
              {{ linked.фио }}
            </RouterLink>
            <p class="text-slate-600">{{ linked.тип_связи }} · {{ linked.телефон || "—" }}</p>
          </div>
        </div>
      </article>

      <article class="card">
        <h3 class="mb-2 text-base font-semibold">История игр</h3>
        <div class="space-y-2">
          <div
            v-for="game in profile.игровая_история || []"
            :key="game.id"
            class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <p><strong>Дата игры:</strong> {{ game.дата_игры }}</p>
            <p><strong>Активность:</strong> {{ game.активность }}</p>
            <p><strong>Мастер:</strong> {{ game.мастер }}</p>
            <p><strong>Золото:</strong> {{ game.золото_распределено }}</p>
          </div>
          <p v-if="!(profile.игровая_история || []).length" class="text-sm text-slate-500">
            Игровая история пока пустая.
          </p>
        </div>
      </article>

      <article v-if="isAdmin" class="card border-dashed">
        <h3 class="mb-2 text-base font-semibold">Аудит (Админ)</h3>
        <div class="grid gap-2 text-sm md:grid-cols-2">
          <p><strong>Технический ID:</strong> {{ profile.технический_id }}</p>
          <p><strong>Создано:</strong> {{ profile.создано || "—" }}</p>
          <p><strong>Последнее изменение:</strong> {{ profile.обновлено || "—" }}</p>
        </div>
      </article>

      <article v-if="isParticipant && canEdit" class="card">
        <h3 class="mb-2 text-base font-semibold">Управление связями родственников</h3>
        <div class="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <select v-model="relationForm.relative_id" class="field">
            <option value="">Выберите родственника</option>
            <option
              v-for="relative in profile.доступные_родственники || []"
              :key="relative.id"
              :value="relative.id"
            >
              {{ relative.фио }}
            </option>
          </select>
          <input v-model="relationForm.relation_type" class="field" placeholder="Тип связи (например, Мать)" />
          <button class="primary-btn" :disabled="relationSaving" @click="addRelation">
            {{ relationSaving ? "Сохраняем..." : "Добавить связь" }}
          </button>
        </div>
        <p v-if="relationError" class="mt-2 text-sm text-rose-700">{{ relationError }}</p>
        <div class="mt-3 space-y-2">
          <div
            v-for="relative in profile.родственники || []"
            :key="`managed-${relative.id}-${relative.relation_id}`"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
          >
            <span>{{ relative.фио }} ({{ relative.тип_связи }})</span>
            <button class="danger-btn !min-h-9" :disabled="relationSaving" @click="removeRelation(relative.relation_id)">
              Удалить
            </button>
          </div>
        </div>
      </article>
    </template>

    <div
      v-if="showEditModal && canEdit"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      @click.self="showEditModal = false"
    >
      <div class="card w-full max-w-2xl">
        <h3 class="mb-3 text-lg font-semibold">Редактирование профиля</h3>
        <div class="grid gap-2 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">ФИО</label>
            <input v-model="editForm.full_name" class="field" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Телефон</label>
            <input v-model="editForm.phone" class="field" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Фото (URL)</label>
            <input v-model="editForm.photo" class="field" />
          </div>
          <template v-if="isParticipant">
            <div>
              <label class="mb-1 block text-sm font-medium">Возраст</label>
              <input v-model="editForm.age" class="field" type="number" min="1" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Школа</label>
              <input v-model="editForm.school" class="field" />
            </div>
            <div class="md:col-span-2">
              <label class="mb-1 block text-sm font-medium">Класс</label>
              <input v-model="editForm.class_name" class="field" />
            </div>
          </template>
          <template v-if="isEmployee">
            <div class="md:col-span-2">
              <label class="mb-1 block text-sm font-medium">Должность</label>
              <input v-model="editForm.position" class="field" />
            </div>
          </template>
          <div class="md:col-span-2">
            <label class="mb-1 block text-sm font-medium">Примечание</label>
            <textarea v-model="editForm.note" class="field min-h-28"></textarea>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button class="secondary-btn" @click="showEditModal = false">Отмена</button>
          <button class="primary-btn" :disabled="saving" @click="saveProfile">
            {{ saving ? "Сохраняем..." : "Сохранить" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

