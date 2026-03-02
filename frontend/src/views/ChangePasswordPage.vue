<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

import api from "../api";
import { clearSession } from "../session";
import { themeToggleLabel, toggleTheme } from "../theme";

const router = useRouter();
const currentPassword = ref("");
const newPassword = ref("");
const loading = ref(false);
const successText = ref("");
const errorText = ref("");

async function submit() {
  loading.value = true;
  successText.value = "";
  errorText.value = "";
  try {
    await api.post("/auth/change-password", {
      current_password: currentPassword.value,
      new_password: newPassword.value,
    });
    successText.value = "Пароль успешно изменен. Войдите повторно.";
    clearSession();
    setTimeout(() => {
      router.push("/login");
    }, 900);
  } catch (error) {
    errorText.value = error.response?.data?.detail || "Не удалось изменить пароль.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <button class="secondary-btn fixed right-3 top-3 !min-h-9 !px-3 !text-xs" @click="toggleTheme">
      {{ themeToggleLabel }}
    </button>
    <div class="card w-full max-w-md space-y-4">
      <h1 class="page-title">Смена пароля</h1>
      <p class="text-sm text-slate-600">
        Для продолжения работы необходимо сменить пароль после сброса.
      </p>
      <form class="space-y-3" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-sm font-medium">Текущий пароль</label>
          <input v-model="currentPassword" class="field" type="password" required />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Новый пароль</label>
          <input v-model="newPassword" class="field" type="password" required />
        </div>
        <button class="primary-btn w-full" type="submit" :disabled="loading">
          {{ loading ? "Сохраняем..." : "Сохранить пароль" }}
        </button>
      </form>

      <p v-if="successText" class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {{ successText }}
      </p>
      <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ errorText }}
      </p>
    </div>
  </div>
</template>

