<script setup>
import { computed, onMounted, reactive, ref } from "vue";

import api from "../api";

const loading = ref(false);
const errorText = ref("");
const subTab = ref("access");

const data = reactive({
  can_write: false,
  accounts: [],
  roles: [],
  tabs: [],
  permissionMatrix: [],
  employeesWithoutAccount: [],
});

const accountCreateForm = reactive({
  employee_id: "",
  role_id: "",
  password: "pas123",
});

const roleCreateForm = reactive({
  name: "",
});

const confirmState = reactive({
  open: false,
  title: "",
  text: "",
  action: null,
  loading: false,
});

const permissionOptions = [
  { value: "HIDDEN", label: "Скрыто" },
  { value: "READ", label: "Чтение" },
  { value: "WRITE", label: "Запись" },
];

const permissionMap = computed(() => {
  const map = new Map();
  for (const row of data.permissionMatrix) {
    map.set(`${row.role_id}:${row.tab_id}`, row.access);
  }
  return map;
});

function tabAccess(roleId, tabId) {
  return permissionMap.value.get(`${roleId}:${tabId}`) || "HIDDEN";
}

function setError(error, fallback) {
  errorText.value = error.response?.data?.detail || fallback;
}

function normalizeAccountRow(row) {
  return {
    ...row,
    логин: row.логин || "",
    сотрудник_фио: row.сотрудник_фио || "",
    роль_id: row.роль_id,
  };
}

async function loadAdminData() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/admin/bootstrap");
    const payload = response.data?.данные || {};
    data.can_write = Boolean(payload.can_write);
    data.accounts = (payload.аккаунты || []).map(normalizeAccountRow);
    data.roles = payload.роли || [];
    data.tabs = payload.вкладки || [];
    data.permissionMatrix = payload.матрица_прав || [];
    data.employeesWithoutAccount = payload.сотрудники_без_аккаунта || [];
  } catch (error) {
    setError(error, "Не удалось загрузить данные администрирования.");
  } finally {
    loading.value = false;
  }
}

async function createAccount() {
  if (!data.can_write) return;
  try {
    await api.post("/admin/accounts", {
      employee_id: Number(accountCreateForm.employee_id),
      role_id: Number(accountCreateForm.role_id),
      password: accountCreateForm.password || "pas123",
    });
    accountCreateForm.employee_id = "";
    accountCreateForm.role_id = "";
    accountCreateForm.password = "pas123";
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось создать аккаунт.");
  }
}

async function saveAccount(row) {
  if (!data.can_write) return;
  try {
    await api.patch(`/admin/accounts/${row.id}`, {
      login: row.логин,
      employee_full_name: row.сотрудник_фио,
      role_id: Number(row.роль_id),
    });
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось сохранить аккаунт.");
  }
}

function openConfirm(title, text, action) {
  confirmState.open = true;
  confirmState.title = title;
  confirmState.text = text;
  confirmState.action = action;
}

function closeConfirm() {
  if (confirmState.loading) return;
  confirmState.open = false;
  confirmState.title = "";
  confirmState.text = "";
  confirmState.action = null;
}

async function runConfirm() {
  if (!confirmState.action) return;
  confirmState.loading = true;
  try {
    await confirmState.action();
    closeConfirm();
  } finally {
    confirmState.loading = false;
  }
}

function confirmBlockToggle(row) {
  openConfirm(
    row.заблокирован ? "Разблокировать аккаунт?" : "Заблокировать аккаунт?",
    row.заблокирован
      ? `Разблокировать логин ${row.логин}?`
      : `Заблокировать логин ${row.логин}? Пользователь не сможет войти.`,
    async () => {
      await api.patch(`/admin/accounts/${row.id}`, { is_blocked: !row.заблокирован });
      await loadAdminData();
    },
  );
}

function confirmResetPassword(row) {
  openConfirm(
    "Сбросить пароль?",
    `Сбросить пароль для ${row.логин} на стандартный pas123 с обязательной сменой?`,
    async () => {
      await api.post(`/admin/accounts/${row.id}/reset-password`);
      await loadAdminData();
    },
  );
}

function confirmDeleteAccount(row) {
  openConfirm(
    "Удалить аккаунт?",
    `Удалить аккаунт ${row.логин}? Действие необратимо.`,
    async () => {
      await api.delete(`/admin/accounts/${row.id}`);
      await loadAdminData();
    },
  );
}

async function createRole() {
  if (!data.can_write || !roleCreateForm.name.trim()) return;
  try {
    await api.post("/admin/roles", {
      name: roleCreateForm.name.trim(),
    });
    roleCreateForm.name = "";
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось создать роль.");
  }
}

async function updateRole(roleId, payload) {
  if (!data.can_write) return;
  try {
    await api.patch(`/admin/roles/${roleId}`, payload);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось обновить роль.");
  }
}

async function deleteRole(roleId) {
  if (!data.can_write) return;
  try {
    await api.delete(`/admin/roles/${roleId}`);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось удалить роль.");
  }
}

async function updatePermission(roleId, tabId, access) {
  if (!data.can_write) return;
  try {
    await api.post(`/admin/roles/${roleId}/permissions`, {
      tab_id: tabId,
      access,
    });
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось обновить права роли.");
  }
}

onMounted(loadAdminData);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Администрирование</h1>
      <p class="mt-2 text-sm text-slate-600">
        Управление доступом и ролями.
      </p>
    </header>

    <div class="card flex flex-wrap gap-2">
      <button
        class="secondary-btn"
        :class="subTab === 'access' ? '!bg-slate-900 !text-white' : ''"
        @click="subTab = 'access'"
      >
        Управление доступом
      </button>
      <button
        class="secondary-btn"
        :class="subTab === 'roles' ? '!bg-slate-900 !text-white' : ''"
        @click="subTab = 'roles'"
      >
        Управление ролями
      </button>
    </div>

    <p v-if="loading" class="text-sm text-slate-500">Загрузка...</p>
    <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ errorText }}
    </p>

    <article v-if="subTab === 'access'" class="card space-y-4">
      <h2 class="text-lg font-semibold">Таблица аккаунтов</h2>

      <div v-if="data.can_write" class="grid gap-2 xl:grid-cols-4">
        <select v-model="accountCreateForm.employee_id" class="field">
          <option value="">Выберите сотрудника</option>
          <option v-for="employee in data.employeesWithoutAccount" :key="employee.id" :value="employee.id">
            {{ employee.фио }}
          </option>
        </select>
        <select v-model="accountCreateForm.role_id" class="field">
          <option value="">Выберите роль</option>
          <option v-for="role in data.roles" :key="role.id" :value="role.id">
            {{ role.название }}
          </option>
        </select>
        <input v-model="accountCreateForm.password" class="field" placeholder="Пароль (по умолчанию pas123)" />
        <button class="primary-btn" @click="createAccount">Добавить аккаунт</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2">Логин</th>
              <th class="p-2">ФИО</th>
              <th class="p-2">Роль</th>
              <th class="p-2">Блок</th>
              <th class="p-2">Смена пароля</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.accounts" :key="item.id" class="border-b border-slate-100">
              <td class="p-2">
                <input v-model="item.логин" class="field !min-h-9 !py-1 text-xs" :disabled="!data.can_write" />
              </td>
              <td class="p-2">
                <input
                  v-model="item.сотрудник_фио"
                  class="field !min-h-9 !py-1 text-xs"
                  :disabled="!data.can_write"
                />
              </td>
              <td class="p-2">
                <select v-model="item.роль_id" class="field !min-h-9 !py-1 text-xs" :disabled="!data.can_write">
                  <option v-for="role in data.roles" :key="role.id" :value="role.id">{{ role.название }}</option>
                </select>
              </td>
              <td class="p-2">
                <span class="rounded-full border border-slate-300 px-2 py-1 text-xs">
                  {{ item.заблокирован ? "Да" : "Нет" }}
                </span>
              </td>
              <td class="p-2">{{ item.нужна_смена_пароля ? "Да" : "Нет" }}</td>
              <td class="p-2">
                <div class="flex flex-wrap gap-1">
                  <button class="secondary-btn !min-h-8 !px-2 text-xs" :disabled="!data.can_write" @click="saveAccount(item)">
                    Сохранить
                  </button>
                  <button
                    class="secondary-btn !min-h-8 !px-2 text-xs"
                    :disabled="!data.can_write"
                    @click="confirmBlockToggle(item)"
                  >
                    {{ item.заблокирован ? "Разблокировать" : "Заблокировать" }}
                  </button>
                  <button
                    class="secondary-btn !min-h-8 !px-2 text-xs"
                    :disabled="!data.can_write"
                    @click="confirmResetPassword(item)"
                  >
                    Сбросить пароль
                  </button>
                  <button
                    class="danger-btn !min-h-8 !px-2 text-xs"
                    :disabled="!data.can_write"
                    @click="confirmDeleteAccount(item)"
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

    <article v-if="subTab === 'roles'" class="card space-y-4">
      <h2 class="text-lg font-semibold">Таблица ролей</h2>
      <div v-if="data.can_write" class="grid gap-2 md:grid-cols-[1fr_auto]">
        <input v-model="roleCreateForm.name" class="field" placeholder="Название новой роли" />
        <button class="primary-btn" @click="createRole">Добавить роль</button>
      </div>

      <div class="space-y-3">
        <div
          v-for="role in data.roles"
          :key="role.id"
          class="rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <input
              class="field !min-h-9 max-w-sm"
              :value="role.название"
              :disabled="!data.can_write"
              @change="updateRole(role.id, { name: $event.target.value })"
            />
            <span class="rounded-full border border-slate-300 px-2 py-1 text-xs">{{ role.код }}</span>
            <span class="rounded-full border border-slate-300 px-2 py-1 text-xs">
              {{ role.заблокирована ? "Заблокирована" : "Активна" }}
            </span>
            <button
              class="secondary-btn !min-h-8 !px-2 text-xs"
              :disabled="!data.can_write"
              @click="updateRole(role.id, { is_blocked: !role.заблокирована })"
            >
              {{ role.заблокирована ? "Разблокировать" : "Заблокировать" }}
            </button>
            <button
              class="danger-btn !min-h-8 !px-2 text-xs"
              :disabled="!data.can_write || role.системная"
              @click="deleteRole(role.id)"
            >
              Удалить роль
            </button>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div v-for="tab in data.tabs" :key="tab.id" class="rounded-lg border border-slate-200 bg-white p-2">
              <p class="text-xs font-semibold">{{ tab.название }}</p>
              <select
                class="field mt-1 !min-h-9 !py-1 text-xs"
                :value="tabAccess(role.id, tab.id)"
                :disabled="!data.can_write"
                @change="updatePermission(role.id, tab.id, $event.target.value)"
              >
                <option v-for="option in permissionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </article>

    <div
      v-if="confirmState.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      @click.self="closeConfirm"
    >
      <div class="card w-full max-w-md space-y-3">
        <h3 class="text-lg font-semibold">{{ confirmState.title }}</h3>
        <p class="text-sm text-slate-600">{{ confirmState.text }}</p>
        <div class="flex justify-end gap-2">
          <button class="secondary-btn" :disabled="confirmState.loading" @click="closeConfirm">Отмена</button>
          <button class="danger-btn" :disabled="confirmState.loading" @click="runConfirm">
            {{ confirmState.loading ? "Выполняем..." : "Подтвердить" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

