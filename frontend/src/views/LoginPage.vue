<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

import api from "../api";
import { setSession } from "../session";

const router = useRouter();
const login = ref("");
const password = ref("");
const loading = ref(false);
const errorText = ref("");

async function submit() {
  loading.value = true;
  errorText.value = "";
  try {
    const response = await api.post("/auth/login", {
      login: login.value.trim(),
      password: password.value,
    });
    const token = response.data?.данные?.токен;
    const user = response.data?.данные?.пользователь;
    if (!token || !user) {
      throw new Error("Сервер вернул неполные данные авторизации.");
    }
    setSession(token, user);
    if (user.нужна_смена_пароля) {
      await router.push("/change-password");
      return;
    }
    let targetRoute = "/people";
    try {
      const navResponse = await api.get("/ui/navigation");
      const firstTab = navResponse.data?.данные?.вкладки?.[0];
      if (firstTab?.route) {
        targetRoute = firstTab.route;
      }
    } catch (_navError) {
      // fallback route already set
    }
    await router.push(targetRoute);
  } catch (error) {
    errorText.value =
      error.response?.data?.detail ||
      error.message ||
      "Ошибка входа. Проверьте логин и пароль.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <div class="card w-full max-w-md space-y-4">
      <div>
        <h1 class="page-title">Авторизация</h1>
      </div>

      <form class="space-y-3" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-sm font-medium">Логин</label>
          <input v-model="login" class="field" autocomplete="username" placeholder="Введите логин" required />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Пароль</label>
          <input
            v-model="password"
            class="field"
            type="password"
            autocomplete="current-password"
            placeholder="Введите пароль"
            required
          />
        </div>

        <button type="submit" class="primary-btn w-full" :disabled="loading">
          {{ loading ? "Выполняем вход..." : "Войти" }}
        </button>
      </form>

      <p v-if="errorText" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ errorText }}
      </p>
    </div>
  </div>
</template>

