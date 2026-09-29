<template>
  <div class="captcha-input">
    <el-input
      :model-value="modelValue.captchaCode"
      placeholder="请输入图中字符"
      maxlength="8"
      class="captcha-field"
      @update:model-value="onCodeInput"
    />
    <img
      v-if="image"
      class="captcha-img"
      :src="image"
      alt="图形验证码"
      title="看不清？点击刷新"
      @click="refresh"
    />
    <div v-else class="captcha-img captcha-placeholder" @click="refresh">点击加载</div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { getCaptcha } from '../api/captcha'

const props = defineProps({
  scene: { type: String, required: true },
  // v-model：{ captchaId, captchaCode }，提交时并入业务请求体
  modelValue: { type: Object, default: () => ({ captchaId: '', captchaCode: '' }) }
})
const emit = defineEmits(['update:modelValue'])

const image = ref('')

// 加载/刷新验证码：换新 captchaId 并清空已输入字符（一次性验证码，失败即废）
async function refresh() {
  try {
    const data = await getCaptcha(props.scene)
    image.value = data.imageBase64 || ''
    emit('update:modelValue', { captchaId: data.captchaId || '', captchaCode: '' })
  } catch { /* 拦截器已提示 */ }
}

function onCodeInput(val) {
  emit('update:modelValue', { captchaId: props.modelValue.captchaId, captchaCode: val })
}

// 挂载与 scene 变化时自动加载一次
onMounted(refresh)
watch(() => props.scene, refresh)

// 父组件在再次触发 CAPTCHA_REQUIRED 时调用换新图
defineExpose({ refresh })
</script>

<style scoped>
.captcha-input {
  display: flex;
  gap: 8px;
  width: 100%;
}
.captcha-field {
  flex: 1;
}
.captcha-img {
  height: 32px;
  width: 96px;
  flex-shrink: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  object-fit: cover;
  background: #f5f7fa;
}
.captcha-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 12px;
  user-select: none;
}
</style>
