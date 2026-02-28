<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CategoryFilter from './components/CategoryFilter.vue'
import FeedList from './components/FeedList.vue'
import LanguageSelector from './components/LanguageSelector.vue'

interface FeedItem {
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
  items: FeedItem[]
}

interface FeedData {
  categories: Category[]
  fetchedAt: string
}

const feedData = ref<FeedData | null>(null)
const activeCategory = ref('all')
const loading = ref(true)
const error = ref('')
const sidebarOpen = ref(false)

onMounted(async () => {
  try {
    const res = await fetch('/feed-data/all-feeds.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    feedData.value = await res.json()
  } catch (e) {
    error.value = '加载订阅数据失败，请先运行 "npm run fetch"。'
  } finally {
    loading.value = false
  }
})

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <button class="menu-btn" @click="toggleSidebar">☰</button>
      <h1>AI RSS 阅读器</h1>
      <a class="author-link" href="https://github.com/baofeidyz/ai-rss" target="_blank" rel="noopener">by baofeidyz</a>
      <div class="header-right">
        <LanguageSelector />
        <span v-if="feedData" class="fetch-time">
          更新于：{{ new Date(feedData.fetchedAt).toLocaleString() }}
        </span>
      </div>
    </header>

    <div v-if="loading" class="loading">正在加载订阅源...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="feedData" class="app-body">
      <aside class="sidebar" :class="{ open: sidebarOpen }">
        <CategoryFilter
          :categories="feedData.categories"
          :active="activeCategory"
          @select="(key: string) => { activeCategory = key; sidebarOpen = false }"
        />
      </aside>
      <div class="sidebar-overlay" :class="{ open: sidebarOpen }" @click="sidebarOpen = false" />
      <main class="main-content">
        <FeedList :categories="feedData.categories" :active-category="activeCategory" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-header h1 {
  font-size: 1.25rem;
  margin: 0;
  white-space: nowrap;
}

.author-link {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  white-space: nowrap;
}

.author-link:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.fetch-time {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.menu-btn {
  display: none;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 4px 8px;
  color: var(--color-text);
}

.app-body {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  overflow-y: auto;
  height: calc(100vh - 53px);
  position: sticky;
  top: 53px;
}

.sidebar-overlay {
  display: none;
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: 20px;
}

.loading, .error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 1.1rem;
}

.error {
  color: var(--color-error);
}

@media (max-width: 768px) {
  .menu-btn {
    display: block;
  }

  .fetch-time {
    display: none;
  }

  .sidebar {
    position: fixed;
    left: -280px;
    top: 53px;
    bottom: 0;
    z-index: 200;
    transition: left 0.3s ease;
  }

  .sidebar.open {
    left: 0;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    top: 53px;
    background: rgba(0, 0, 0, 0.4);
    z-index: 199;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .sidebar-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }

  .main-content {
    padding: 12px;
  }
}
</style>
