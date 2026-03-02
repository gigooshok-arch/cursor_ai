<script setup>
import { computed, onMounted, reactive, ref } from "vue";

import api from "../api";

const loading = ref(false);
const errorText = ref("");
const subTab = ref("access");

const data = reactive({
  access: "READ",
  can_write: false,
  accounts: [],
  roles: [],
  tabs: [],
  permissionMatrix: [],
  employeesWithoutAccount: [],
  views: [],
});

const accountCreateForm = reactive({
  employee_id: "",
  role_id: "",
  password: "pas123",
});

const roleCreateForm = reactive({
  name: "",
});

const tabCreateForm = reactive({
  title: "",
  route: "",
  db_view_name: "",
  description: "",
  sort_order: 0,
  is_enabled: true,
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

function roleNameById(id) {
  return data.roles.find((item) => item.id === id)?.название || "—";
}

function tabAccess(roleId, tabId) {
  return permissionMap.value.get(`${roleId}:${tabId}`) || "HIDDEN";
}

function setError(error, fallback) {
  errorText.value = error.response?.data?.detail || fallback;
}

async function loadAdminData() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.get("/admin/bootstrap");
    const payload = response.data?.данные || {};
    data.access = payload.доступ || "READ";
    data.can_write = Boolean(payload.can_write);
    data.accounts = payload.аккаунты || [];
    data.roles = payload.роли || [];
    data.tabs = payload.вкладки || [];
    data.permissionMatrix = payload.матрица_прав || [];
    data.employeesWithoutAccount = payload.сотрудники_без_аккаунта || [];
    data.views = payload.представления_бд || [];
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

async function updateAccount(accountId, payload) {
  if (!data.can_write) return;
  try {
    await api.patch(`/admin/accounts/${accountId}`, payload);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось обновить аккаунт.");
  }
}

async function resetPassword(accountId) {
  if (!data.can_write) return;
  try {
    await api.post(`/admin/accounts/${accountId}/reset-password`);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось сбросить пароль.");
  }
}

async function deleteAccount(accountId) {
  if (!data.can_write) return;
  try {
    await api.delete(`/admin/accounts/${accountId}`);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось удалить аккаунт.");
  }
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

async function createTab() {
  if (!data.can_write || !tabCreateForm.title.trim() || !tabCreateForm.route.trim()) return;
  try {
    await api.post("/admin/tabs", {
      title: tabCreateForm.title.trim(),
      route: tabCreateForm.route.trim(),
      db_view_name: tabCreateForm.db_view_name.trim() || null,
      description: tabCreateForm.description.trim() || null,
      sort_order: Number(tabCreateForm.sort_order) || 0,
      is_enabled: Boolean(tabCreateForm.is_enabled),
    });
    tabCreateForm.title = "";
    tabCreateForm.route = "";
    tabCreateForm.db_view_name = "";
    tabCreateForm.description = "";
    tabCreateForm.sort_order = 0;
    tabCreateForm.is_enabled = true;
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось создать вкладку.");
  }
}

async function updateTab(tabId, payload) {
  if (!data.can_write) return;
  try {
    await api.patch(`/admin/tabs/${tabId}`, payload);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось обновить вкладку.");
  }
}

async function deleteTab(tabId) {
  if (!data.can_write) return;
  try {
    await api.delete(`/admin/tabs/${tabId}`);
    await loadAdminData();
  } catch (error) {
    setError(error, "Не удалось удалить вкладку.");
  }
}

onMounted(loadAdminData);
</script>

<template>
  <section class="space-y-4">
    <header>
      <h1 class="page-title">Администрирование</h1>
      <p class="mt-2 text-sm text-slate-600">
        Управление доступом, ролями и вкладками интерфейса.
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
      <button
        class="secondary-btn"
        :class="subTab === 'tabs' ? '!bg-slate-900 !text-white' : ''"
        @click="subTab = 'tabs'"
      >
        Управление вкладками
      </button>
      <span class="ml-auto rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600">
        Доступ: {{ data.access }}
      </span>
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
              <td class="p-2">{{ item.логин }}</td>
              <td class="p-2">{{ item.сотрудник_фио }}</td>
              <td class="p-2">
                <select
                  class="field !min-h-9 !py-1 text-xs"
                  :value="item.роль_id"
                  :disabled="!data.can_write"
                  @change="updateAccount(item.id, { role_id: Number($event.target.value) })"
                >
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
                  <button
                    class="secondary-btn !min-h-8 !px-2 text-xs"
                    :disabled="!data.can_write"
                    @click="updateAccount(item.id, { is_blocked: !item.заблокирован })"
                  >
                    {{ item.заблокирован ? "Разблокировать" : "Заблокировать" }}
                  </button>
                  <button
                    class="secondary-btn !min-h-8 !px-2 text-xs"
                    :disabled="!data.can_write"
                    @click="resetPassword(item.id)"
                  >
                    Сбросить пароль
                  </button>
                  <button
                    class="danger-btn !min-h-8 !px-2 text-xs"
                    :disabled="!data.can_write"
                    @click="deleteAccount(item.id)"
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

    <article v-if="subTab === 'tabs'" class="card space-y-4">
      <h2 class="text-lg font-semibold">Таблица вкладок</h2>

      <div v-if="data.can_write" class="grid gap-2 xl:grid-cols-3">
        <input v-model="tabCreateForm.title" class="field" placeholder="Название вкладки" />
        <input v-model="tabCreateForm.route" class="field" placeholder="/my-tab" />
        <select v-model="tabCreateForm.db_view_name" class="field">
          <option value="">Без представления</option>
          <option v-for="viewName in data.views" :key="viewName" :value="viewName">{{ viewName }}</option>
        </select>
        <input v-model="tabCreateForm.description" class="field xl:col-span-2" placeholder="Описание" />
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="tabCreateForm.sort_order"
            class="field"
            type="number"
            placeholder="Порядок"
          />
          <label class="flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm">
            <input v-model="tabCreateForm.is_enabled" type="checkbox" />
            Включена
          </label>
        </div>
        <button class="primary-btn xl:col-span-3" @click="createTab">Создать вкладку</button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left">
              <th class="p-2">Название</th>
              <th class="p-2">Route</th>
              <th class="p-2">Представление</th>
              <th class="p-2">Порядок</th>
              <th class="p-2">Включена</th>
              <th class="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tab in data.tabs" :key="tab.id" class="border-b border-slate-100">
              <td class="p-2">
                <input
                  class="field !min-h-9 !py-1 text-xs"
                  :value="tab.название"
                  :disabled="!data.can_write"
                  @change="updateTab(tab.id, { title: $event.target.value })"
                />
              </td>
              <td class="p-2">
                <input
                  class="field !min-h-9 !py-1 text-xs"
                  :value="tab.route"
                  :disabled="!data.can_write"
                  @change="updateTab(tab.id, { route: $event.target.value })"
                />
              </td>
              <td class="p-2">
                <select
                  class="field !min-h-9 !py-1 text-xs"
                  :value="tab.db_view_name || ''"
                  :disabled="!data.can_write"
                  @change="updateTab(tab.id, { db_view_name: $event.target.value || null })"
                >
                  <option value="">Без представления</option>
                  <option v-for="viewName in data.views" :key="viewName" :value="viewName">{{ viewName }}</option>
                </select>
              </td>
              <td class="p-2">
                <input
                  class="field !min-h-9 !py-1 text-xs"
                  type="number"
                  :value="tab.порядок"
                  :disabled="!data.can_write"
                  @change="updateTab(tab.id, { sort_order: Number($event.target.value) })"
                />
              </td>
              <td class="p-2">
                <label class="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    :checked="tab.включена"
                    :disabled="!data.can_write"
                    @change="updateTab(tab.id, { is_enabled: $event.target.checked })"
                  />
                  {{ tab.включена ? "Да" : "Нет" }}
                </label>
              </td>
              <td class="p-2">
                <button class="danger-btn !min-h-8 !px-2 text-xs" :disabled="!data.can_write" @click="deleteTab(tab.id)">
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

