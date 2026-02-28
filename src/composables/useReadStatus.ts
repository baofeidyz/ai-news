import { reactive } from 'vue'

const STORAGE_KEY = 'rss-reader-read'

function loadRead(): Set<string> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return new Set(data ? JSON.parse(data) : [])
  } catch {
    return new Set()
  }
}

function saveRead(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

function hashLink(link: string): string {
  let hash = 0
  for (let i = 0; i < link.length; i++) {
    const char = link.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return String(hash)
}

const state = reactive({
  readIds: loadRead(),
})

export function useReadStatus() {
  function isRead(link: string): boolean {
    return state.readIds.has(hashLink(link))
  }

  function markAsRead(link: string) {
    const id = hashLink(link)
    state.readIds.add(id)
    saveRead(state.readIds)
  }

  function markAllAsRead(links: string[]) {
    for (const link of links) {
      state.readIds.add(hashLink(link))
    }
    saveRead(state.readIds)
  }

  function readCount(): number {
    return state.readIds.size
  }

  return { isRead, markAsRead, markAllAsRead, readCount }
}
