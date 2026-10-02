// 资料（头像/昵称/简介）变更同步：
// 同标签页走 window CustomEvent；跨标签页走 BroadcastChannel，收到广播后转发为本地事件。
// jsdom 等无 BroadcastChannel 环境下自动降级为仅同标签页，不报错。
const EVENT_NAME = 'blog:profile-updated'
const CHANNEL_NAME = 'blog-profile-sync'

let channel = null

function ensureChannel() {
  if (channel || typeof BroadcastChannel === 'undefined') return channel
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = () => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }
  return channel
}

// 资料保存成功后调用：本地派发 + 跨标签页广播
export function notifyProfileUpdated() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
  ensureChannel()?.postMessage({ type: 'profile-updated' })
}

// 注册监听（首次调用时建立广播频道），返回注销函数
export function onProfileUpdated(cb) {
  ensureChannel()
  window.addEventListener(EVENT_NAME, cb)
  return () => window.removeEventListener(EVENT_NAME, cb)
}
