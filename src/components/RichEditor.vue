<template>
  <div class="rich-editor" :style="{ '--rt-editor-height': height }">
    <Toolbar
      class="rt-toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <Editor
      :model-value="modelValue"
      class="rt-editor"
      :default-config="editorConfig"
      mode="default"
      @update:model-value="v => emit('update:modelValue', v)"
      @on-created="onEditorCreated"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { uploadAndResolveUrl } from '../api/upload'

// wangeditor 生命周期的唯一主人：Editor/Toolbar 组件、官方 CSS、实例销毁全部收口于此，
// 页面只通过 v-model 收发 HTML 字符串，永远拿不到编辑器实例。
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请输入正文...' },
  height: { type: String, default: '480px' }
})
const emit = defineEmits(['update:modelValue'])

const editorRef = shallowRef()
const toolbarConfig = {}
const editorConfig = computed(() => ({
  placeholder: props.placeholder,
  MENU_CONF: {
    uploadImage: {
      // 自定义上传：走统一 http 实例（带 token、走 /api 代理）
      async customUpload(file, insertFn) {
        try {
          const url = await uploadAndResolveUrl(file)
          insertFn(url, file.name, url)
        } catch { /* 拦截器已提示 */ }
      }
    }
  }
}))

function onEditorCreated(editor) {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  // 实例销毁归组件自己（页面只持有 htmlContent 字符串，卸载补存由
  // useArticleAutosave 自己的钩子读 ref 完成，不碰本实例，钩序无耦合）
  editorRef.value?.destroy()
  editorRef.value = undefined
})
</script>

<style scoped>
.rt-toolbar {
  border-bottom: 1px solid #e4e7ed;
}
.rt-editor {
  height: var(--rt-editor-height) !important;
  overflow-y: hidden;
}
</style>
