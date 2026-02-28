<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import FeedItem from './FeedItem.vue'
import { useReadStatus } from '../composables/useReadStatus'

interface FeedItemData {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  titleZh?: string
  descriptionZh?: string
}

interface Category {
  name: string
  key: string
  itemCount: number
  items: FeedItemData[]
}

const props = defineProps<{
  categories: Category[]
  activeCategory: string
}>()

const STORAGE_KEY = 'rss-selected-sources'

const PAGE_SIZE = 30
const currentPage = ref(1)
const showUnreadOnly = ref(false)
const selectedSources = ref<Set<string>>(new Set())
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

// localStorage persistence
function loadSelectedSources() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        selectedSources.value = new Set(arr)
      }
    }
  } catch {}
}

function saveSelectedSources() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedSources.value]))
}

onMounted(() => {
  loadSelectedSources()
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

const { isRead, markAllAsRead } = useReadStatus()

const categoryItems = computed(() => {
  let items: FeedItemData[]
  if (props.activeCategory === 'all') {
    items = props.categories.flatMap(c => c.items)
  } else {
    const cat = props.categories.find(c => c.key === props.activeCategory)
    items = cat ? cat.items : []
  }
  return items
})

const availableSources = computed(() => {
  const sources = new Set(categoryItems.value.map(item => item.source))
  return Array.from(sources).sort()
})

// Intersection of selectedSources and availableSources in current category
const activeFilters = computed(() => {
  return availableSources.value.filter(s => selectedSources.value.has(s))
})

const filterLabel = computed(() => {
  const count = activeFilters.value.length
  if (count === 0) return '全部来源'
  if (count === 1) return activeFilters.value[0]
  return `${count} 个来源`
})

function toggleSource(source: string) {
  const next = new Set(selectedSources.value)
  if (next.has(source)) {
    next.delete(source)
  } else {
    next.add(source)
  }
  selectedSources.value = next
  saveSelectedSources()
}

function clearSources() {
  selectedSources.value = new Set()
  saveSelectedSources()
}

const filteredItems = computed(() => {
  let items = [...categoryItems.value]

  items.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
    return db - da
  })

  if (activeFilters.value.length > 0) {
    const filterSet = new Set(activeFilters.value)
    items = items.filter(item => filterSet.has(item.source))
  }

  if (showUnreadOnly.value) {
    items = items.filter(item => !isRead(item.link))
  }

  return items
})

const paginatedItems = computed(() => {
  return filteredItems.value.slice(0, currentPage.value * PAGE_SIZE)
})

const hasMore = computed(() => {
  return paginatedItems.value.length < filteredItems.value.length
})

function loadMore() {
  currentPage.value++
}

function handleMarkAllRead() {
  const links = filteredItems.value.map(item => item.link)
  markAllAsRead(links)
}

// Reset page when category changes
watch(() => props.activeCategory, () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="feed-list">
    <div class="feed-toolbar">
      <span class="item-count">{{ filteredItems.length }} 篇文章</span>
      <div class="source-filter" ref="dropdownRef">
        <button class="source-filter-btn" :class="{ active: activeFilters.length > 0 }" @click="dropdownOpen = !dropdownOpen">
          {{ filterLabel }}
          <span class="arrow">▾</span>
        </button>
        <div v-if="dropdownOpen" class="source-dropdown">
          <div class="source-dropdown-header">
            <span>筛选来源</span>
            <button v-if="activeFilters.length > 0" class="clear-btn" @click="clearSources">清除</button>
          </div>
          <ul class="source-list">
            <li v-for="src in availableSources" :key="src" @click="toggleSource(src)">
              <input type="checkbox" :checked="selectedSources.has(src)" @click.stop="toggleSource(src)" />
              <span class="source-name">{{ src }}</span>
            </li>
          </ul>
        </div>
      </div>
      <label class="unread-toggle">
        <input type="checkbox" v-model="showUnreadOnly" />
        仅未读
      </label>
      <button class="mark-all-btn" @click="handleMarkAllRead">全部标为已读</button>
    </div>

    <div v-if="paginatedItems.length === 0" class="empty">
      没有找到文章。
    </div>

    <FeedItem
      v-for="(item, i) in paginatedItems"
      :key="item.link + i"
      :item="item"
    />

    <button v-if="hasMore" class="load-more" @click="loadMore">
      加载更多（剩余 {{ filteredItems.length - paginatedItems.length }}）
    </button>
  </div>
</template>

<style scoped>
.feed-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.item-count {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.source-filter {
  position: relative;
}

.source-filter-btn {
  font-size: 0.85rem;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.source-filter-btn.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.source-filter-btn .arrow {
  font-size: 0.7rem;
}

.source-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  max-height: 320px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 300;
  display: flex;
  flex-direction: column;
}

.source-dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.clear-btn {
  font-size: 0.75rem;
  padding: 2px 8px;
  border: none;
  border-radius: 3px;
  background: none;
  color: var(--color-accent);
  cursor: pointer;
}

.clear-btn:hover {
  background: var(--color-hover);
}

.source-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
}

.source-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.1s;
}

.source-list li:hover {
  background: var(--color-hover);
}

.source-list li input[type="checkbox"] {
  cursor: pointer;
  flex-shrink: 0;
}

.source-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-toggle {
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
}

.mark-all-btn {
  margin-left: auto;
  font-size: 0.8rem;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.mark-all-btn:hover {
  background: var(--color-hover);
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.load-more {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.9rem;
}

.load-more:hover {
  background: var(--color-hover);
}
</style>
