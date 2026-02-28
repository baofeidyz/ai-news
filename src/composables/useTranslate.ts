import { ref } from 'vue'

const LANG_KEY = 'rss-reader-lang'

const targetLang = ref(localStorage.getItem(LANG_KEY) || 'zh-CN')

export const LANGUAGES = [
  { code: 'zh-CN', name: '中文 (简体)' },
  { code: 'zh-TW', name: '中文 (繁體)' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
]

export function useTranslate() {
  function setLanguage(lang: string) {
    targetLang.value = lang
    localStorage.setItem(LANG_KEY, lang)
  }

  async function translate(text: string): Promise<string> {
    if (!text.trim()) return text
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang.value}&dt=t&q=${encodeURIComponent(text)}`
      const res = await fetch(url)
      const data = await res.json()
      return data[0].map((s: [string]) => s[0]).join('')
    } catch {
      return '[Translation failed]'
    }
  }

  return { targetLang, setLanguage, translate }
}
