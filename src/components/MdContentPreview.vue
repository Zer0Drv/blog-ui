<template>
  <!-- sanitize 唯一挂载点：任何 Markdown 正文渲染都必须经过本组件，
       漏接 :sanitize 即存储型 XSS 敞口（#9），严禁在别处直挂 MdPreview -->
  <MdPreview
    :model-value="content"
    :editor-id="editorId"
    :sanitize="sanitizeHtml"
    @on-get-catalog="list => emit('get-catalog', list)"
  />
</template>

<script setup>
import '../lib/mdEditorConfig'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/preview.css'
import { sanitizeHtml } from '../utils/sanitize'

// Markdown 正文只读预览（详情页 / 历史版本抽屉共用）。
// 差异点全部以 props/emits 收口：editorId 供 MdCatalog 联动，
// get-catalog 透传给需要目录的调用方（无监听方时静默丢弃）。
defineProps({
  content: { type: String, default: '' },
  editorId: { type: String, default: undefined }
})
const emit = defineEmits(['get-catalog'])
</script>
