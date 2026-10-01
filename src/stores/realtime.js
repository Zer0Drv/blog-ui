import { ref } from 'vue'
import { defineStore } from 'pinia'

// WebSocket 实时通道：私信（private_message）+ 通知（notification）推送
// 断线指数退避重连（1s→2s→4s→8s→16s，上限 5 次）；WS 不可用时各页面轮询兜底
// 鉴权：同源 Cookie（AUTH_TOKEN）由浏览器握手时自动携带，URL 不再传 token（#13）
// 注意：本 store 不 import auth store（防循环依赖），仅在已登录（fetchMe 成功）后被调用
export const useRealtimeStore = defineStore('realtime', () => {
  const connected = ref(false)

  const MAX_RECONNECT = 5
  let ws = null
  let reconnectAttempts = 0
  let reconnectTimer = null
  let manualClose = false
  const listeners = new Map() // type -> Set<cb>

  function on(type, cb) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(cb)
  }

  function off(type, cb) {
    listeners.get(type)?.delete(cb)
  }

  function dispatch(type, data) {
    listeners.get(type)?.forEach(cb => {
      try { cb(data) } catch { /* 单个订阅者异常不影响其他订阅者 */ }
    })
  }

  function connect() {
    // 已连接/连接中不重复连
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    clearTimeout(reconnectTimer)
    reconnectTimer = null
    manualClose = false
    // 同源：http(s)://host -> ws(s)://host，开发环境经 vite 代理转发到后端；
    // 浏览器握手自动携带同源 Cookie 完成鉴权，不再拼 ?token=（#13）
    const url = location.origin.replace(/^http/, 'ws') + '/ws'
    let socket
    try {
      socket = new WebSocket(url)
    } catch {
      return // 环境无 WebSocket（如单测 jsdom）：静默跳过，轮询兜底
    }
    ws = socket
    socket.onopen = () => {
      connected.value = true
      reconnectAttempts = 0
    }
    socket.onmessage = e => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg && msg.type) dispatch(msg.type, msg.data)
    }
    socket.onerror = () => { /* 错误后必有 onclose，统一在 onclose 里处理重连 */ }
    socket.onclose = () => {
      connected.value = false
      if (ws === socket) ws = null
      if (manualClose) return // 主动断开不重连
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT || reconnectTimer) return
    const delay = 1000 * 2 ** reconnectAttempts // 1s→2s→4s→8s→16s
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function disconnect() {
    manualClose = true
    clearTimeout(reconnectTimer)
    reconnectTimer = null
    reconnectAttempts = 0
    if (ws) {
      const socket = ws
      ws = null
      try { socket.close() } catch { /* 已关闭则忽略 */ }
    }
    connected.value = false
  }

  return { connected, connect, disconnect, on, off }
})
