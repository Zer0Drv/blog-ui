import DOMPurify from 'dompurify'

// 统一 HTML 消毒入口（存储型 XSS 前端防线，与后端 jsoup 清洗双保险）
// 默认配置即移除 <script>、on* 事件处理器、javascript: 伪协议等
export function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty || '')
}
