import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRealtimeStore } from '../stores/realtime'

/**
 * WS 订阅 + 断线轮询兜底的唯一惯用法：挂载订阅、卸载退订；
 * mode='fallback'（默认）：WS 断开才按 interval 轮询、连上即停；
 * mode='always'：始终轮询（配合 pauseWhenHidden 页面隐藏时暂停）。
 * poll: null = 显式不要轮询兜底。
 * @param {string} type WS 消息类型（'private_message' | 'notification'）
 * @param {(data: any) => void} onPush
 * @param {{ poll?: (() => void | Promise<void>) | null, interval?: number,
 *           mode?: 'fallback' | 'always', pauseWhenHidden?: boolean }} [opts]
 * @returns {{ connected: Ref<boolean> }}
 */
export function useRealtimeTopic(type, onPush, opts = {}) {
  const { poll = null, interval = 5000, mode = 'fallback', pauseWhenHidden = false } = opts
  const realtime = useRealtimeStore()

  let timer = null

  function startPolling() {
    if (!poll || timer) return
    if (pauseWhenHidden && document.visibilityState === 'hidden') return
    timer = setInterval(() => { poll() }, interval)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // mode='fallback'：WS 断开才轮询；mode='always'：始终轮询
  function shouldPoll() {
    return !!poll && (mode === 'always' || !realtime.connected)
  }

  function syncPolling() {
    if (shouldPoll()) startPolling()
    else stopPolling()
  }

  // 页面隐藏时暂停轮询；恢复可见立即补一次并恢复节奏
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      stopPolling()
    } else if (shouldPoll()) {
      poll()
      startPolling()
    }
  }

  // WS 连接状态联动轮询兜底：断开起轮询，连上即停
  watch(() => realtime.connected, syncPolling)

  onMounted(() => {
    realtime.on(type, onPush)
    syncPolling()
    if (pauseWhenHidden) document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    realtime.off(type, onPush)
    stopPolling()
    if (pauseWhenHidden) document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { connected: computed(() => realtime.connected) }
}
