// 未读徽标数量变更同步：
// 已读通知/私信后，同标签页走 window CustomEvent 让导航栏立即刷新未读数；
// 跨标签页走 BroadcastChannel，收到广播后转发为本地事件（其他标签页的徽标也即时更新）。
// jsdom 等无 BroadcastChannel 环境下自动降级为仅同标签页，不报错。
const EVENT_NAME = 'blog:unread-changed'
const CHANNEL_NAME = 'blog-unread-sync'

let channel = null

function ensureChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = () => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }
  return channel
}

// 未读数可能变化（标记已读成功等）后调用：本地派发 + 跨标签页广播
export function notifyUnreadChanged() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
  ensureChannel()?.postMessage({ type: 'unread-changed' })
}

// 注册监听（首次调用时建立广播频道），返回注销函数
export function onUnreadChanged(cb) {
  ensureChannel()
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}
