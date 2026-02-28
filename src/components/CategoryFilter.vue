<script setup lang="ts">
import { useReadStatus } from '../composables/useReadStatus'

interface Category {
  name: string
  key: string
  itemCount: number
}

const props = defineProps<{
  categories: Category[]
  active: string
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const { readCount } = useReadStatus()

const totalItems = () => props.categories.reduce((sum, c) => sum + c.itemCount, 0)
</script>

<template>
  <nav class="category-filter">
    <div class="filter-header">
      <h3>分类</h3>
      <span class="read-badge">已读 {{ readCount() }}</span>
    </div>
    <ul>
      <li
        :class="{ active: active === 'all' }"
        @click="emit('select', 'all')"
      >
        <span class="cat-name">全部</span>
        <span class="cat-count">{{ totalItems() }}</span>
      </li>
      <li
        v-for="cat in categories"
        :key="cat.key"
        :class="{ active: active === cat.key }"
        @click="emit('select', cat.key)"
      >
        <span class="cat-name">{{ cat.name }}</span>
        <span class="cat-count">{{ cat.itemCount }}</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.category-filter {
  padding: 16px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-header h3 {
  margin: 0;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.read-badge {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  padding: 2px 8px;
  border-radius: 10px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 0.9rem;
}

li:hover {
  background: var(--color-hover);
}

li.active {
  background: var(--color-active);
  font-weight: 600;
}

.cat-count {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  padding: 1px 8px;
  border-radius: 10px;
}
</style>
