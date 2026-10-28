<template>
  <div class="series-page">
    <RouterLink to="/my/series">返回我的系列</RouterLink>
    <h1>{{ seriesId ? '编辑系列' : '新建系列' }}</h1>
    <p v-if="loading" role="status">正在加载系列…</p>
    <div v-if="loadError" role="alert" class="error">{{ loadError }} <button @click="load">重试加载</button></div>
    <form v-else @submit.prevent="save">
      <fieldset :disabled="busy || loading">
        <div class="panel">
          <p v-if="ownerName" class="muted">作者：{{ ownerName }}。只能收录这位作者的文章，管理员也不能更换作者。</p>
          <label>系列标题<input v-model="form.title" required maxlength="200" /></label>
          <label>系列地址<input v-model="form.slug" required maxlength="200" placeholder="如 vue-basics" /></label>
          <p class="muted">使用小写字母、数字和单个连字符；公开地址为 /series/{{ form.slug || '系列地址' }}。</p>
          <label>系列简介<textarea v-model="form.description" maxlength="2000" rows="4" /></label>
          <label>封面地址<input v-model="form.cover" maxlength="512" placeholder="可留空或上传图片" /></label>
          <label>上传系列封面<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" @change="uploadCover" /></label>
          <img v-if="form.cover" :src="resolveUploadUrl(form.cover)" alt="系列封面预览" class="series-cover" />
          <label>系列状态<select v-model="form.status" aria-label="系列状态"><option value="DRAFT">草稿（隐藏）</option><option value="PUBLISHED">公开</option></select></label>
          <p class="muted">公开目录只展示已发布到点的公开文章；草稿、定时、密码保护、私密或下架文章可保留编排，但不会对访客显示。</p>
        </div>
        <div class="panel">
          <h2>章节顺序（{{ selected.length }}/200）</h2>
          <p v-if="!selected.length" class="muted">尚未添加文章。空系列也可以保存或公开。</p>
          <ol v-else class="chapter-list">
            <li v-for="(chapter, index) in selected" :key="chapter.id" class="selected-chapter" :data-article-id="chapter.id">
              <span>{{ chapter.title }}</span><span class="muted"> · {{ chapter.visible ? '公开可读' : '不对访客展示' }}</span>
              <div class="chapter-actions">
                <button type="button" :aria-label="`上移《${chapter.title}》`" :disabled="index === 0" @click="move(index, -1)">上移</button>
                <button type="button" :aria-label="`下移《${chapter.title}》`" :disabled="index === selected.length - 1" @click="move(index, 1)">下移</button>
                <button type="button" :aria-label="`移出《${chapter.title}》`" @click="selected.splice(index, 1)">移出</button>
              </div>
            </li>
          </ol>
          <h2>添加作者文章</h2>
          <label>查找文章<input v-model="candidateKeyword" @keydown.enter.prevent="findCandidates" /></label>
          <button type="button" @click="findCandidates">查找</button>
          <p v-if="candidateLoading" role="status">正在查找文章…</p>
          <p v-else-if="candidateError" class="error" role="alert">{{ candidateError }} <button type="button" @click="loadCandidates">重试查找</button></p>
          <template v-else>
            <p v-if="!candidates?.records?.length" class="muted">没有可添加的文章。</p>
            <div v-for="chapter in candidates?.records || []" :key="chapter.id" class="candidate actions">
              <span>{{ chapter.title }} <span class="muted">{{ chapter.visible ? '公开可读' : '不对访客展示' }}</span></span>
              <button type="button" :aria-label="`添加《${chapter.title}》`" :disabled="hasChapter(chapter.id) || selected.length >= 200" @click="add(chapter)">{{ hasChapter(chapter.id) ? '已添加' : '添加' }}</button>
            </div>
            <nav v-if="candidates?.total > 10 || candidatePage > 1" class="pager" aria-label="候选文章分页">
              <button type="button" :disabled="candidatePage <= 1" @click="candidatePage--; loadCandidates()">上一页文章</button><span>第 {{ candidatePage }} 页</span>
              <button type="button" :disabled="candidatePage * 10 >= Number(candidates?.total || 0)" @click="candidatePage++; loadCandidates()">下一页文章</button>
            </nav>
          </template>
        </div>
      </fieldset>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <p v-if="success" role="status">{{ success }}</p>
      <div class="actions">
        <button class="primary" :disabled="busy || loading" type="submit">{{ saving ? '正在保存…' : '保存系列' }}</button>
        <button v-if="seriesId" type="button" :disabled="busy || loading" @click="reload">重新加载系列</button>
        <RouterLink v-if="savedStatus === 'PUBLISHED' && savedSlug" :to="`/series/${savedSlug}`">查看公开系列</RouterLink>
        <button v-if="seriesId" type="button" class="danger" :disabled="busy || loading" @click="remove">删除系列</button>
      </div>
    </form>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { getManagedSeries, createSeries, updateSeries, deleteSeries, pageSeriesCandidates } from '../api/series'
import { resolveUploadUrl, uploadImage } from '../api/upload'
import { useSeriesResource } from '../composables/useSeriesResource'
import { SLUG_PATTERN } from '../utils/articleEdit'
import '../assets/series.css'
const route = useRoute(), router = useRouter()
const seriesId = computed(() => route.params.id || null)
const blank = () => ({ title: '', slug: '', description: '', cover: '', status: 'DRAFT' })
const form = reactive(blank()), selected = ref([]), revision = ref(null), ownerName = ref('')
const savedStatus = ref('DRAFT'), savedSlug = ref('')
const loading = ref(false), loadError = ref(''), saving = ref(false), uploading = ref(false), deleting = ref(false)
const error = ref(''), success = ref('')
const busy = computed(() => saving.value || uploading.value || deleting.value)
const candidateKeyword = ref(''), candidatePage = ref(1)
let searchedCandidateKeyword = ''
const { data: candidates, loading: candidateLoading, error: candidateError, load: fetchCandidates, reset: resetCandidates } = useSeriesResource(pageSeriesCandidates)
let sequence = 0, active = true
const snapshot = () => JSON.stringify({ ...form, articleIds: selected.value.map(article => article.id) })
const cleanState = ref(snapshot())
const dirty = computed(() => snapshot() !== cleanState.value)
function fill(data) {
  Object.assign(form, blank(), Object.fromEntries(Object.keys(blank()).map(key => [key, data[key] ?? blank()[key]])))
  selected.value = data.articles || []
  revision.value = data.revision
  ownerName.value = data.ownerName || ''
  savedStatus.value = data.status || 'DRAFT'
  savedSlug.value = data.slug || ''
  cleanState.value = snapshot()
}
async function load() {
  const current = ++sequence
  loading.value = true; loadError.value = ''; error.value = ''; success.value = ''
  fill({})
  resetCandidates()
  candidateKeyword.value = ''; searchedCandidateKeyword = ''; candidatePage.value = 1
  try {
    if (seriesId.value) {
      const data = await getManagedSeries(seriesId.value)
      if (!active || current !== sequence) return
      fill(data)
    }
    if (active && current === sequence) await loadCandidates()
  } catch (e) { if (active && current === sequence) loadError.value = e.message || '系列无法加载。' }
  finally { if (active && current === sequence) loading.value = false }
}
function loadCandidates() { return fetchCandidates({ ...(seriesId.value ? { seriesId: seriesId.value } : {}), keyword: searchedCandidateKeyword, page: candidatePage.value, size: 10 }) }
function findCandidates() { searchedCandidateKeyword = candidateKeyword.value.trim(); candidatePage.value = 1; loadCandidates() }
const hasChapter = id => selected.value.some(chapter => String(chapter.id) === String(id))
function add(chapter) { if (!hasChapter(chapter.id) && selected.value.length < 200) selected.value.push(chapter) }
function move(index, direction) {
  const destination = index + direction
  if (destination < 0 || destination >= selected.value.length) return
  const [chapter] = selected.value.splice(index, 1)
  selected.value.splice(destination, 0, chapter)
}
function failure(e) { error.value = String(e.code) === '40900' ? '系列已在其他页面修改，当前编辑已保留。请重新加载系列后再修改。' : e.message || '操作失败，请重试。' }
async function save() {
  if (busy.value || loading.value || loadError.value) return
  error.value = ''; success.value = ''
  if (!form.title.trim()) { error.value = '系列标题不能为空。'; return }
  if (!SLUG_PATTERN.test(form.slug.trim()) || ['manage', 'by-article'].includes(form.slug.trim())) { error.value = '系列地址须为小写字母、数字和连字符，不能使用 manage 或 by-article。'; return }
  const current = sequence, id = seriesId.value
  const payload = { ...form, title: form.title.trim(), slug: form.slug.trim(), articleIds: selected.value.map(chapter => chapter.id), ...(id ? { revision: revision.value } : {}) }
  saving.value = true
  try {
    const data = id ? await updateSeries(id, payload) : await createSeries(payload)
    if (!active || current !== sequence) return
    fill(data)
    success.value = '系列已保存'
    saving.value = false
    if (!id) {
      await router.replace(`/my/series/${data.id}`)
      if (active && String(seriesId.value) === String(data.id)) success.value = '系列已保存'
    }
  } catch (e) { if (active && current === sequence) failure(e) }
  finally { if (active && current === sequence) saving.value = false }
}
async function confirmLeave() {
  if (busy.value) return false
  if (!dirty.value) return true
  try { await ElMessageBox.confirm('系列有未保存的修改，确认放弃？', '未保存的修改', { confirmButtonText: '放弃修改', cancelButtonText: '继续编辑' }); return true }
  catch { return false }
}
async function reload() {
  const current = sequence
  if (await confirmLeave() && active && current === sequence) load()
}
async function remove() {
  if (busy.value || !seriesId.value) return
  const current = sequence, id = seriesId.value, expectedRevision = revision.value
  try { await ElMessageBox.confirm('删除系列将移除章节编排，但不会删除文章。此操作不可撤销。', '删除系列', { type: 'warning', confirmButtonText: '删除系列', cancelButtonText: '取消' }) }
  catch { return }
  if (!active || current !== sequence || busy.value) return
  deleting.value = true; error.value = ''; success.value = ''
  try {
    await deleteSeries(id, expectedRevision)
    if (!active || current !== sequence) return
    cleanState.value = snapshot()
    deleting.value = false
    await router.push('/my/series')
  } catch (e) { if (active && current === sequence) failure(e) }
  finally { if (active && current === sequence) deleting.value = false }
}
async function uploadCover(event) {
  const file = event.target.files?.[0]
  if (!file || busy.value) return
  const current = sequence
  uploading.value = true; error.value = ''
  try { const data = await uploadImage(file); if (active && current === sequence) form.cover = data.url }
  catch (e) { if (active && current === sequence) failure(e) }
  finally { if (active && current === sequence) uploading.value = false; event.target.value = '' }
}
function beforeUnload(event) { if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(confirmLeave)
watch(seriesId, load, { immediate: true })
onBeforeUnmount(() => { active = false; sequence++; window.removeEventListener('beforeunload', beforeUnload) })
</script>
