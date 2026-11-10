<template>
  <section class="comparison" aria-label="版本差异">
    <p>从 <strong>{{ beforeLabel }}</strong> 到 <strong>{{ afterLabel }}</strong></p>
    <p>历史快照包含标题、摘要、封面、分类、编辑格式和正文。标签、可见性及发布时间未纳入对比。</p>
    <p v-if="!fields.length && !body.changed" role="status">可比较的内容一致。</p>
    <dl v-else-if="fields.length" class="fields">
      <template v-for="field in fields" :key="field.label">
        <dt>{{ field.label }}</dt>
        <dd>
          <del><span class="sr-only">移除：</span>{{ field.before || '（空）' }}</del>
          <ins><span class="sr-only">新增：</span>{{ field.after || '（空）' }}</ins>
        </dd>
      </template>
    </dl>
    <template v-if="body.changed">
      <h3>正文差异</h3>
      <p v-if="rich">富文本按消毒后的 HTML 结构显示。</p>
      <p v-if="body.coarse">正文较长，变化部分按区块显示。</p>
      <p>− 移除 · + 新增</p>
      <div class="body-diff" tabindex="0" aria-label="可滚动的正文差异">
        <pre v-for="(block, index) in body.blocks" :key="index" :class="block.kind"><span
          v-if="block.kind !== 'same'" class="sr-only"
        >{{ block.kind === 'removed' ? '移除：' : '新增：' }}</span>{{ block.lines.map(line => prefix[block.kind] + line).join('\n') }}</pre>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { articleVersionDiff } from '../utils/articleVersionDiff'

const props = defineProps({
  before: { type: Object, required: true },
  after: { type: Object, required: true },
  beforeLabel: { type: String, required: true },
  afterLabel: { type: String, required: true }
})
const metadata = [
  ['title', '标题'], ['summary', '摘要'], ['cover', '封面'],
  ['categoryId', '分类 ID'], ['editorType', '编辑格式']
]
const fields = computed(() => metadata.map(([key, label]) => ({
  label,
  before: String(props.before[key] ?? ''),
  after: String(props.after[key] ?? '')
})).filter(field => field.before !== field.after))
const rich = computed(() => [props.before, props.after].some(version => version.editorType === 'RICHTEXT'))
const body = computed(() => articleVersionDiff(props.before, props.after))
const prefix = { removed: '− ', added: '+ ', same: '  ' }
</script>

<style scoped>
.comparison { overflow-wrap: anywhere; }
.fields { margin: 12px 0; }
.fields dt { font-weight: 600; }
.fields dd { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin: 4px 0 12px; }
.fields dd > * { padding: 4px 8px; white-space: pre-wrap; }
.body-diff { max-height: 55vh; overflow: auto; border: 1px solid var(--el-border-color); }
.body-diff pre { margin: 0; padding: 4px 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
del, .removed { color: #8a1921; background: #fde8e9; }
ins, .added { color: #12612e; background: #e3f6e9; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
