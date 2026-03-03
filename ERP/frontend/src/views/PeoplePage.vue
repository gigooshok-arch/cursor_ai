<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";

import api from "../api";

const loading = ref(false);
const errorText = ref("");

const payload = reactive({
  can_write: false,
  employees: [],
  participants: [],
  relatives: [],
  relations: [],
});

const selected = reactive({
  employees: new Set(),
  participants: new Set(),
  relatives: new Set(),
});

const employeeForm = reactive({
  full_name: "",
  position: "",
  phone: "",
  photo: "",
});

const participantForm = reactive({
  full_name: "",
  phone: "",
  photo: "",
  age: "",
  school: "",
  class_name: "",
  note: "",
});

const relativeForm = reactive({
  full_name: "",
  phone: "",
  photo: "",
  note: "",
});

const relationForm = reactive({
  participant_id: "",
  relative_id: "",
  relation_type: "мама",
});

function setError(error, fallback) {
  errorText.value = error.response?.data?.detail || fallback;
}

function normalizePhone(value) {
  return value || null;
}

function castInt(value) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}

async function loadPeople() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/people/bootstrap");
    const data = response.data?.данные || {};
    payload.can_write = Boolean(data.can_write);
    payload.employees = data.сотрудники || [];
    payload.participants = data.подростки || [];
    payload.relatives = data.родители || [];
    payload.relations = data.связи || [];
    selected.employees = new Set();
    selected.participants = new Set();
    selected.relatives = new Set();
  } catch (error) {
    setError(error, "Не удалось загрузить вкладку «Люди».");
  } finally {
    loading.value = false;
  }
}

async function createEmployee() {
  if (!payload.can_write) return;
  try {
    await api.post("/people/employees", {
      full_name: employeeForm.full_name.trim(),
      position: employeeForm.position.trim() || null,
      phone: normalizePhone(employeeForm.phone.trim()),
      photo: employeeForm.photo.trim() || null,
    });
    employeeForm.full_name = "";
    employeeForm.position = "";
    employeeForm.phone = "";
    employeeForm.photo = "";
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось добавить сотрудника.");
  }
}

async function saveEmployee(row) {
  if (!payload.can_write) return;
  try {
    await api.patch(`/people/employees/${row.id}`, {
      full_name: row.фио,
      position: row.должность,
      phone: normalizePhone(row.телефон),
      photo: row.фото,
    });
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось сохранить сотрудника.");
  }
}

async function deleteEmployee(id) {
  if (!payload.can_write) return;
  try {
    await api.delete(`/people/employees/${id}`);
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось удалить сотрудника.");
  }
}

async function createParticipant() {
  if (!payload.can_write) return;
  try {
    await api.post("/people/participants", {
      full_name: participantForm.full_name.trim(),
      phone: normalizePhone(participantForm.phone.trim()),
      photo: participantForm.photo.trim() || null,
      age: castInt(participantForm.age),
      school: participantForm.school.trim() || null,
      class_name: participantForm.class_name.trim() || null,
      note: participantForm.note.trim() || null,
    });
    participantForm.full_name = "";
    participantForm.phone = "";
    participantForm.photo = "";
    participantForm.age = "";
    participantForm.school = "";
    participantForm.class_name = "";
    participantForm.note = "";
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось добавить подростка.");
  }
}

async function saveParticipant(row) {
  if (!payload.can_write) return;
  try {
    await api.patch(`/people/participants/${row.id}`, {
      full_name: row.фио,
      phone: normalizePhone(row.телефон),
      photo: row.фото,
      age: castInt(row.возраст),
      school: row.школа,
      class_name: row.класс,
      note: row.примечание,
    });
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось сохранить подростка.");
  }
}

async function deleteParticipant(id) {
  if (!payload.can_write) return;
  try {
    await api.delete(`/people/participants/${id}`);
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось удалить подростка.");
  }
}

async function createRelative() {
  if (!payload.can_write) return;
  try {
    await api.post("/people/relatives", {
      full_name: relativeForm.full_name.trim(),
      phone: normalizePhone(relativeForm.phone.trim()),
      photo: relativeForm.photo.trim() || null,
      note: relativeForm.note.trim() || null,
    });
    relativeForm.full_name = "";
    relativeForm.phone = "";
    relativeForm.photo = "";
    relativeForm.note = "";
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось добавить родителя.");
  }
}

async function saveRelative(row) {
  if (!payload.can_write) return;
  try {
    await api.patch(`/people/relatives/${row.id}`, {
      full_name: row.фио,
      phone: normalizePhone(row.телефон),
      photo: row.фото,
      note: row.примечание,
    });
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось сохранить родителя.");
  }
}

async function deleteRelative(id) {
  if (!payload.can_write) return;
  try {
    await api.delete(`/people/relatives/${id}`);
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось удалить родителя.");
  }
}

async function createRelation() {
  if (!payload.can_write) return;
  try {
    await api.post("/people/relations", {
      participant_id: Number(relationForm.participant_id),
      relative_id: Number(relationForm.relative_id),
      relation_type: relationForm.relation_type.trim(),
    });
    relationForm.participant_id = "";
    relationForm.relative_id = "";
    relationForm.relation_type = "мама";
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось создать связь.");
  }
}

async function deleteRelation(id) {
  if (!payload.can_write) return;
  try {
    await api.delete(`/people/relations/${id}`);
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось удалить связь.");
  }
}

async function bulkDelete(entity) {
  if (!payload.can_write) return;
  const ids = Array.from(selected[entity] || []);
  if (!ids.length) return;
  try {
    await api.post("/people/bulk-delete", { entity, ids });
    await loadPeople();
  } catch (error) {
    setError(error, "Не удалось выполнить массовое удаление.");
  }
}

function toggleSelect(entity, id, checked) {
  const set = selected[entity];
  if (!set) return;
  if (checked) {
    set.add(id);
  } else {
    set.delete(id);
  }
  selected[entity] = new Set(set);
}

onMounted(loadPeople);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Люди</h1>
      <p class="mt-2 text-sm text-slate-600">
        Таблицы «Сотрудники», «Родители», «Подростки» и управление связями.
      </p>
    </header>

    <p v-if="loading" class="text-sm text-slate-500">Загрузка...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <article class="card space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Сотрудники</h2>
        <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="bulkDelete('employees')">
          Удалить выбранные
        </button>
      </div>

      <div v-if="payload.can_write" class="grid gap-2 xl:grid-cols-4">
        <input v-model="employeeForm.full_name" class="field" placeholder="ФИО" />
        <input v-model="employeeForm.position" class="field" placeholder="Должность" />
        <input v-model="employeeForm.phone" class="field" placeholder="+7 (XXX) XXX-XX-XX" />
        <button class="primary-btn" @click="createEmployee">Добавить сотрудника</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2"></th>
              <th class="p-2">ФИО</th>
              <th class="p-2">Роль</th>
              <th class="p-2">Должность</th>
              <th class="p-2">Телефон</th>
              <th class="p-2">Карточка</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.employees" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">
                <input
                  type="checkbox"
                  :checked="selected.employees.has(row.id)"
                  @change="toggleSelect('employees', row.id, $event.target.checked)"
                />
              </td>
              <td class="p-2">
                <input v-model="row.фио" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">{{ row.роль || "—" }}</td>
              <td class="p-2">
                <input
                  v-model="row.должность"
                  class="field !min-h-9 !py-1 text-xs"
                  :disabled="!payload.can_write"
                />
              </td>
              <td class="p-2">
                <input v-model="row.телефон" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <RouterLink class="text-sky-700 underline" :to="`/profile/employee/${row.id}`">Открыть</RouterLink>
              </td>
              <td class="p-2">
                <div class="flex gap-1">
                  <button class="secondary-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="saveEmployee(row)">
                    Сохранить
                  </button>
                  <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="deleteEmployee(row.id)">
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
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Подростки</h2>
        <button
          class="danger-btn !min-h-8 !px-2 text-xs"
          :disabled="!payload.can_write"
          @click="bulkDelete('participants')"
        >
          Удалить выбранные
        </button>
      </div>

      <div v-if="payload.can_write" class="grid gap-2 xl:grid-cols-4">
        <input v-model="participantForm.full_name" class="field" placeholder="ФИО" />
        <input v-model="participantForm.phone" class="field" placeholder="+7 (XXX) XXX-XX-XX" />
        <input v-model="participantForm.age" class="field" type="number" placeholder="Возраст" />
        <button class="primary-btn" @click="createParticipant">Добавить подростка</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2"></th>
              <th class="p-2">ФИО</th>
              <th class="p-2">Телефон</th>
              <th class="p-2">Возраст</th>
              <th class="p-2">Золото</th>
              <th class="p-2">Карточка</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.participants" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">
                <input
                  type="checkbox"
                  :checked="selected.participants.has(row.id)"
                  @change="toggleSelect('participants', row.id, $event.target.checked)"
                />
              </td>
              <td class="p-2">
                <input v-model="row.фио" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <input v-model="row.телефон" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <input
                  v-model="row.возраст"
                  class="field !min-h-9 !py-1 text-xs"
                  type="number"
                  :disabled="!payload.can_write"
                />
              </td>
              <td class="p-2">{{ row.золото || 0 }}</td>
              <td class="p-2">
                <RouterLink class="text-sky-700 underline" :to="`/profile/participant/${row.id}`">Открыть</RouterLink>
              </td>
              <td class="p-2">
                <div class="flex gap-1">
                  <button
                    class="secondary-btn !min-h-8 !px-2 text-xs"
                    :disabled="!payload.can_write"
                    @click="saveParticipant(row)"
                  >
                    Сохранить
                  </button>
                  <button
                    class="danger-btn !min-h-8 !px-2 text-xs"
                    :disabled="!payload.can_write"
                    @click="deleteParticipant(row.id)"
                  >
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
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Родители</h2>
        <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="bulkDelete('relatives')">
          Удалить выбранные
        </button>
      </div>

      <div v-if="payload.can_write" class="grid gap-2 xl:grid-cols-4">
        <input v-model="relativeForm.full_name" class="field" placeholder="ФИО" />
        <input v-model="relativeForm.phone" class="field" placeholder="+7 (XXX) XXX-XX-XX" />
        <input v-model="relativeForm.note" class="field" placeholder="Примечание" />
        <button class="primary-btn" @click="createRelative">Добавить родителя</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2"></th>
              <th class="p-2">ФИО</th>
              <th class="p-2">Телефон</th>
              <th class="p-2">Примечание</th>
              <th class="p-2">Связей</th>
              <th class="p-2">Карточка</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.relatives" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">
                <input
                  type="checkbox"
                  :checked="selected.relatives.has(row.id)"
                  @change="toggleSelect('relatives', row.id, $event.target.checked)"
                />
              </td>
              <td class="p-2">
                <input v-model="row.фио" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <input v-model="row.телефон" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">
                <input v-model="row.примечание" class="field !min-h-9 !py-1 text-xs" :disabled="!payload.can_write" />
              </td>
              <td class="p-2">{{ row.связей || 0 }}</td>
              <td class="p-2">
                <RouterLink class="text-sky-700 underline" :to="`/profile/relative/${row.id}`">Открыть</RouterLink>
              </td>
              <td class="p-2">
                <div class="flex gap-1">
                  <button class="secondary-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="saveRelative(row)">
                    Сохранить
                  </button>
                  <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="deleteRelative(row.id)">
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
      <h2 class="text-lg font-semibold">Связи подросток—родитель</h2>

      <div v-if="payload.can_write" class="grid gap-2 md:grid-cols-4">
        <select v-model="relationForm.participant_id" class="field">
          <option value="">Подросток</option>
          <option v-for="row in payload.participants" :key="row.id" :value="row.id">{{ row.фио }}</option>
        </select>
        <select v-model="relationForm.relative_id" class="field">
          <option value="">Родитель</option>
          <option v-for="row in payload.relatives" :key="row.id" :value="row.id">{{ row.фио }}</option>
        </select>
        <input v-model="relationForm.relation_type" class="field" placeholder="Тип связи" />
        <button class="primary-btn" @click="createRelation">Добавить связь</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2">Подросток</th>
              <th class="p-2">Родитель</th>
              <th class="p-2">Тип связи</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in payload.relations" :key="row.id" class="border-b border-slate-100">
              <td class="p-2">{{ row.participant_name }}</td>
              <td class="p-2">{{ row.relative_name }}</td>
              <td class="p-2">{{ row.relation_type }}</td>
              <td class="p-2">
                <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!payload.can_write" @click="deleteRelation(row.id)">
                  Удалить
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>

