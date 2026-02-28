<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

interface FeedItemData {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  titleZh?: string
  descriptionZh?: string
}

const props = defineProps<{
  article: FeedItemData
  articles: FeedItemData[]
  currentIndex: number
}>()

const emit = defineEmits<{
  navigate: [index: number]
  close: []
}>()

const hasPrev = ref(false)
const hasNext = ref(false)
const touchStartY = ref(0)
const touchStartTime = ref(0)

// View mode: 'content' (RSS summary) or 'iframe' (original page)
const viewMode = ref<'content' | 'iframe'>('content')
const iframeLoading = ref(false)
const iframeFailed = ref(false)

// Mobile swipe hint
const showSwipeHint = ref(false)
const swipeHintTimer = ref<ReturnType<typeof setTimeout> | null>(null)

function isMobile() {
  return window.innerWidth <= 768
}

function updateNav() {
  hasPrev.value = props.currentIndex > 0
  hasNext.value = props.currentIndex < props.articles.length - 1
}

watch(() => props.currentIndex, updateNav, { immediate: true })

// Reset view mode when switching articles
watch(() => props.article.link, () => {
  viewMode.value = 'content'
  iframeLoading.value = false
  iframeFailed.value = false
})

function goPrev() {
  if (hasPrev.value) {
    emit('navigate', props.currentIndex - 1)
  }
}

function goNext() {
  if (hasNext.value) {
    emit('navigate', props.currentIndex + 1)
  }
}

function loadOriginalPage() {
  viewMode.value = 'iframe'
  iframeLoading.value = true
  iframeFailed.value = false
}

function handleIframeLoad() {
  iframeLoading.value = false
}

function handleIframeError() {
  iframeLoading.value = false
  iframeFailed.value = true
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault()
    goPrev()
  } else if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault()
    goNext()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

function handleTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0].clientY
  touchStartTime.value = Date.now()
}

function handleTouchEnd(e: TouchEvent) {
  const dy = e.changedTouches[0].clientY - touchStartY.value
  const dt = Date.now() - touchStartTime.value
  if (dt > 500 || Math.abs(dy) < 60) return

  if (dy < 0 && hasNext.value) {
    goNext()
  } else if (dy > 0 && hasPrev.value) {
    goPrev()
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // Show swipe hint on mobile
  if (isMobile() && props.articles.length > 1) {
    showSwipeHint.value = true
    swipeHintTimer.value = setTimeout(() => {
      showSwipeHint.value = false
    }, 3000)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (swipeHintTimer.value) {
    clearTimeout(swipeHintTimer.value)
  }
})
</script>

<template>
  <div class="article-viewer">
    <div class="viewer-header">
      <button class="back-btn" @click="$emit('close')">← 返回</button>
      <div class="viewer-title-area">
        <span class="viewer-source">{{ article.source }}</span>
        <h2 class="viewer-title">{{ article.titleZh || article.title }}</h2>
      </div>
      <div class="viewer-actions">
        <button class="nav-btn" :disabled="!hasPrev" @click="goPrev" title="上一篇 (↑)">▲</button>
        <span class="nav-pos">{{ currentIndex + 1 }}/{{ articles.length }}</span>
        <button class="nav-btn" :disabled="!hasNext" @click="goNext" title="下一篇 (↓)">▼</button>
        <a class="open-link" :href="article.link" target="_blank" rel="noopener">新窗口打开 ↗</a>
      </div>
    </div>

    <div
      class="viewer-body"
      @touchstart.passive="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Content mode: show RSS article summary -->
      <div v-if="viewMode === 'content'" class="article-content">
        <article class="article-detail">
          <h1 class="article-title">{{ article.title }}</h1>
          <p v-if="article.titleZh && article.titleZh !== article.title" class="article-title-zh">
            {{ article.titleZh }}
          </p>
          <div class="article-meta">
            <span class="meta-source">{{ article.source }}</span>
            <span v-if="article.pubDate" class="meta-date">{{ formatDate(article.pubDate) }}</span>
          </div>
          <div v-if="article.description" class="article-desc">
            {{ article.description }}
          </div>
          <div v-if="article.descriptionZh" class="article-desc-zh">
            {{ article.descriptionZh }}
          </div>
          <div class="article-actions">
            <a class="action-btn primary" :href="article.link" target="_blank" rel="noopener">
              新窗口打开原文 ↗
            </a>
            <button class="action-btn" @click="loadOriginalPage">
              尝试加载原始页面
            </button>
          </div>
        </article>
      </div>

      <!-- Iframe mode: load original page -->
      <template v-if="viewMode === 'iframe'">
        <div v-if="iframeLoading" class="iframe-loading">正在加载原始页面...</div>
        <div v-if="iframeFailed" class="iframe-failed">
          <p>页面加载失败，该网站可能禁止了嵌入访问。</p>
          <div class="article-actions">
            <a class="action-btn primary" :href="article.link" target="_blank" rel="noopener">
              新窗口打开 ↗
            </a>
            <button class="action-btn" @click="viewMode = 'content'">返回摘要</button>
          </div>
        </div>
        <iframe
          v-show="!iframeFailed"
          :key="article.link"
          :src="article.link"
          class="viewer-iframe"
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerpolicy="no-referrer"
          @load="handleIframeLoad"
          @error="handleIframeError"
        />
        <!-- Touch overlay for mobile swipe on top of iframe -->
        <div
          class="touch-overlay"
          @touchstart.passive="handleTouchStart"
          @touchend="handleTouchEnd"
        />
      </template>

      <!-- Mobile swipe hint -->
      <Transition name="hint-fade">
        <div v-if="showSwipeHint" class="swipe-hint" @click="showSwipeHint = false">
          <span class="swipe-hint-icon">&#8645;</span>
          <span>上下滑动切换文章</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.article-viewer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 53px);
  background: var(--color-bg);
}

.viewer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
  min-height: 44px;
}

.back-btn {
  font-size: 0.85rem;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--color-hover);
}

.viewer-title-area {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.viewer-source {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-bg);
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.viewer-title {
  font-size: 0.9rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.nav-btn {
  font-size: 0.7rem;
  padding: 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: none;
  color: var(--color-text);
  cursor: pointer;
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-hover);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.nav-pos {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.open-link {
  font-size: 0.8rem;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-accent);
  text-decoration: none;
  white-space: nowrap;
}

.open-link:hover {
  background: var(--color-accent-bg);
}

.viewer-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Article content mode */
.article-content {
  height: 100%;
  overflow-y: auto;
  padding: 32px;
}

.article-detail {
  max-width: 720px;
  margin: 0 auto;
}

.article-title {
  font-size: 1.5rem;
  line-height: 1.4;
  margin: 0 0 8px;
}

.article-title-zh {
  font-size: 1.2rem;
  color: var(--color-text-secondary);
  margin: 0 0 16px;
  line-height: 1.4;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.meta-source {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-bg);
  padding: 2px 10px;
  border-radius: 4px;
}

.meta-date {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.article-desc {
  font-size: 1rem;
  line-height: 1.8;
  color: var(--color-text);
  margin-bottom: 16px;
  white-space: pre-line;
}

.article-desc-zh {
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  white-space: pre-line;
}

.article-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.action-btn {
  font-size: 0.9rem;
  padding: 8px 20px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.action-btn:hover {
  background: var(--color-hover);
}

.action-btn.primary {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.action-btn.primary:hover {
  opacity: 0.9;
}

/* Iframe mode */
.viewer-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.iframe-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.iframe-failed {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--color-text-secondary);
}

.iframe-failed p {
  margin-bottom: 16px;
}

.iframe-failed .article-actions {
  justify-content: center;
}

.touch-overlay {
  display: none;
}

/* Swipe hint toast */
.swipe-hint {
  display: none;
}

.hint-fade-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.hint-fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.hint-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, 10px);
}

.hint-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

@media (max-width: 768px) {
  .viewer-header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }

  .viewer-title-area {
    order: 2;
    width: 100%;
    flex-basis: 100%;
  }

  .viewer-title {
    font-size: 0.85rem;
  }

  .viewer-actions {
    order: 1;
  }

  .article-content {
    padding: 20px 16px;
  }

  .article-title {
    font-size: 1.2rem;
  }

  .article-title-zh {
    font-size: 1rem;
  }

  .touch-overlay {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    z-index: 10;
  }

  .nav-btn {
    display: none;
  }

  .nav-pos {
    display: none;
  }

  .swipe-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    padding: 10px 20px;
    border-radius: 24px;
    font-size: 0.85rem;
    z-index: 20;
    white-space: nowrap;
    pointer-events: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .swipe-hint-icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .article-actions {
    flex-direction: column;
  }

  .action-btn {
    text-align: center;
  }
}
</style>
