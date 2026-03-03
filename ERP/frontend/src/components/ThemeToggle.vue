<script setup>
import { computed } from "vue";

import { themeState, toggleTheme } from "../theme";

const isDark = computed(() => themeState.mode === "dark");
</script>

<template>
  <button class="theme-toggle" type="button" @click="toggleTheme" :aria-pressed="isDark">
    <span class="text-xs font-semibold">{{ isDark ? "Тёмная" : "Светлая" }}</span>
    <span class="theme-switch" :class="{ 'theme-switch--on': isDark }">
      <span class="theme-switch-knob"></span>
    </span>
  </button>
</template>

