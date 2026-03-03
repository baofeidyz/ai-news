<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import CategoryFilter from './components/CategoryFilter.vue'
import FeedList from './components/FeedList.vue'
import LanguageSelector from './components/LanguageSelector.vue'
import ArticleViewer from './components/ArticleViewer.vue'
import { useReadStatus } from './composables/useReadStatus'

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

// Reading mode state
const readingMode = ref(false)
const selectedArticle = ref<FeedItem | null>(null)
const articleList = ref<FeedItem[]>([])
const articleIndex = ref(0)

const { markAsRead } = useReadStatus()

onMounted(async () => {
  window.addEventListener('popstate', onPopState)
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

onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
})

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function handleSelectArticle(item: FeedItem, index: number, list: FeedItem[]) {
  selectedArticle.value = item
  articleList.value = list
  articleIndex.value = index
  readingMode.value = true
  sidebarOpen.value = false
  // Auto mark as read when opening article
  markAsRead(item.link)
  history.pushState({ reading: true }, '')
}

function handleNavigate(index: number) {
  articleIndex.value = index
  selectedArticle.value = articleList.value[index]
  // Auto mark as read when navigating to article
  if (selectedArticle.value) {
    markAsRead(selectedArticle.value.link)
  }
}

function exitReadingMode() {
  if (readingMode.value) {
    history.back()
  }
}

function onPopState() {
  if (readingMode.value) {
    readingMode.value = false
    selectedArticle.value = null
  }
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <button class="menu-btn" @click="toggleSidebar">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <h1>AI NEWS</h1>
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
      <!-- Sidebar: collapses in reading mode -->
      <aside class="sidebar" :class="{ collapsed: readingMode, open: sidebarOpen }">
        <div class="sidebar-inner">
          <CategoryFilter
            :categories="feedData.categories"
            :active="activeCategory"
            @select="(key: string) => { activeCategory = key; sidebarOpen = false }"
          />
        </div>
      </aside>
      <div class="sidebar-overlay" :class="{ open: sidebarOpen && !readingMode }" @click="sidebarOpen = false" />

      <!-- List area: full width normally, narrow compact in reading mode -->
      <div class="list-area" :class="{ compact: readingMode }">
        <FeedList
          :categories="feedData.categories"
          :active-category="activeCategory"
          :compact="readingMode"
          :active-article-link="selectedArticle?.link ?? null"
          @select-article="handleSelectArticle"
        />
      </div>

      <!-- Viewer area: hidden normally, expands in reading mode -->
      <div class="viewer-area" :class="{ active: readingMode }">
        <ArticleViewer
          v-if="selectedArticle"
          :article="selectedArticle"
          :articles="articleList"
          :current-index="articleIndex"
          @navigate="handleNavigate"
          @close="exitReadingMode"
        />
      </div>
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
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur-heavy));
  -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
  border-bottom: 1px solid var(--glass-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-header h1 {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  letter-spacing: -0.02em;
}

.author-link {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  white-space: nowrap;
}

.author-link:hover {
  color: var(--color-accent);
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
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-xs);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 6px 8px;
  color: var(--color-text);
  transition: background 0.2s;
}

.menu-btn:hover {
  background: var(--color-hover);
}

.app-body {
  display: flex;
  flex: 1;
}

/* Sidebar */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  height: calc(100vh - 53px);
  position: sticky;
  top: 53px;
  overflow: hidden;
  transition: width 0.4s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.sidebar.collapsed {
  width: 0;
  border-right-color: transparent;
}

.sidebar-inner {
  width: 260px;
  height: 100%;
  overflow-y: auto;
}

.sidebar-overlay {
  display: none;
}

/* List area */
.list-area {
  flex: 1;
  min-width: 0;
  padding: 20px;
  transition: flex 0.4s cubic-bezier(0.32, 0.72, 0, 1), max-width 0.4s cubic-bezier(0.32, 0.72, 0, 1), padding 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
}

.list-area.compact {
  flex: 0 0 300px;
  max-width: 300px;
  padding: 0;
  border-right: 1px solid var(--color-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

/* Viewer area */
.viewer-area {
  flex: 0 1 0%;
  min-width: 0;
  overflow: hidden;
  transition: flex 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.viewer-area.active {
  flex: 1 1 0%;
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
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fetch-time {
    display: block;
    font-size: 0.7rem;
  }

  .sidebar {
    position: fixed;
    left: -280px;
    top: 53px;
    bottom: 0;
    width: 280px;
    z-index: 200;
    transition: left 0.4s cubic-bezier(0.32, 0.72, 0, 1);
    height: auto;
  }

  .sidebar.open:not(.collapsed) {
    left: 0;
  }

  .sidebar.collapsed {
    left: -280px;
    width: 280px;
  }

  .sidebar-inner {
    width: 280px;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    top: 53px;
    background: rgba(0, 0, 0, 0.3);
    z-index: 199;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .sidebar-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }

  .list-area {
    padding: 12px;
    transition: flex 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1), padding 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .list-area.compact {
    flex: 0 0 0px;
    max-width: 0;
    padding: 0;
    opacity: 0;
    border-right: none;
  }

  .viewer-area.active {
    flex: 1;
  }
}
</style>
