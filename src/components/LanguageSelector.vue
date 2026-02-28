<script setup lang="ts">
import { useTranslate, LANGUAGES } from '../composables/useTranslate'

const { targetLang, setLanguage } = useTranslate()
</script>

<template>
  <select class="lang-select" :value="targetLang" @change="setLanguage(($event.target as HTMLSelectElement).value)">
    <option v-for="lang in LANGUAGES" :key="lang.code" :value="lang.code">
      {{ lang.name }}
    </option>
  </select>
</template>

<style scoped>
.lang-select {
  font-size: 0.8rem;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}
</style>
