import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElInputNumber, ElMessage, ElMessageBox, ElSelect, ElSwitch } from 'element-plus'
import AdminSysConfig from '../admin/AdminSysConfig.vue'
import { getSysConfig, updateSysConfig, resetSysConfig, getSysConfigAudit } from '../../api/sysConfig'

const guard = vi.hoisted(() => ({ fn: null }))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: fn => { guard.fn = fn } }))
vi.mock('../../api/sysConfig', () => ({ getSysConfig: vi.fn(), updateSysConfig: vi.fn(), resetSysConfig: vi.fn(), getSysConfigAudit: vi.fn() }))
let wrapper, data
const copy = value => JSON.parse(JSON.stringify(value))
const row = (key, type, value, group, extra = {}) => ({ key, type, value, activeValue: value, defaultValue: value, fallbackValue: value,
  group, description: `${group}参数`, source: 'YAML', hotReload: true, restartRequired: false,
  validation: { min: 1, max: 100000, options: ['LOCAL', 'MINIO'] }, ...extra })
const field = key => wrapper.find(`[data-key="${key}"]`)
const button = text => wrapper.findAll('button').find(b => b.text().trim() === text)
async function open() {
  wrapper = mount(AdminSysConfig, { global: { plugins: [ElementPlus], stubs: { ApplicationRestart: true } }, attachTo: document.body })
  await flushPromises()
}
async function changeNumber(value = 7) {
  field('blog.upload-daily-limit').findComponent(ElInputNumber).vm.$emit('update:modelValue', value)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  data = [
    row('blog.upload-daily-limit', 'INT', 100, '上传'),
    row('blog.search.fulltext-enabled', 'BOOL', false, '搜索'),
    row('blog.upload.allowed-extensions', 'JSON', ['png', 'jpg'], '上传', { validation: { options: ['png', 'jpg', 'webp'] } }),
    row('blog.upload.storage', 'STRING', 'MINIO', '上传', { activeValue: 'LOCAL', fallbackValue: 'LOCAL', source: 'DATABASE', hotReload: false, restartRequired: true }),
    row('blog.auth.cookie.same-site', 'STRING', 'Strict', '认证', { source: 'ENVIRONMENT', hotReload: false, validation: { options: ['Strict', 'Lax', 'None'] } })
  ]
  getSysConfig.mockImplementation(async () => copy(data))
  updateSysConfig.mockImplementation(async changes => { for (const item of data) if (item.key in changes) { item.value = copy(changes[item.key]); item.source = 'DATABASE' } })
  resetSysConfig.mockImplementation(async key => { const item = data.find(row => row.key === key); item.value = item.fallbackValue; item.source = 'YAML'; item.restartRequired = false })
  getSysConfigAudit.mockResolvedValue({ records: [{ id: '1', key: 'blog.upload.storage', action: 'SET', oldValue: 'LOCAL', newValue: 'MINIO', operatorId: '7', createdAt: '2026-10-15T10:00:00' }], total: 1 })
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm')
  vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
  vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); document.body.innerHTML = '' })

describe('系统参数管理', () => {
  it('分组展示强类型输入、来源、默认值、重启待办与审计记录', async () => {
    await open()
    expect(wrapper.findAll('section h3').map(h => h.text())).toEqual(['上传', '搜索', '认证'])
    expect(field('blog.upload-daily-limit').findComponent(ElInputNumber).props()).toMatchObject({ modelValue: 100, min: 1, max: 100000, precision: 0 })
    expect(field('blog.search.fulltext-enabled').findComponent(ElSwitch).exists()).toBe(true)
    expect(field('blog.upload.allowed-extensions').findComponent(ElSelect).props('multiple')).toBe(true)
    expect(field('blog.upload.storage').text()).toContain('待重启')
    expect(field('blog.upload.storage').text()).toContain('当前生效：LOCAL')
    expect(field('blog.auth.cookie.same-site').text()).toContain('环境变量')
    expect(wrapper.text()).toContain('2026-10-15T10:00:00')
    expect(button('保存更改').element.disabled).toBe(true)
  })

  it('只提交修改的键，保留数字/布尔/JSON 原生类型并刷新审计', async () => {
    await open()
    await changeNumber(7)
    field('blog.search.fulltext-enabled').findComponent(ElSwitch).vm.$emit('update:modelValue', true)
    field('blog.upload.allowed-extensions').findComponent(ElSelect).vm.$emit('update:modelValue', ['png'])
    await flushPromises()
    await button('保存更改').trigger('click')
    await flushPromises()
    expect(updateSysConfig).toHaveBeenCalledWith({ 'blog.upload-daily-limit': 7, 'blog.search.fulltext-enabled': true, 'blog.upload.allowed-extensions': ['png'] })
    expect(getSysConfigAudit).toHaveBeenLastCalledWith({ page: 1, size: 20 })
    expect(button('保存更改').element.disabled).toBe(true)
  })

  it('服务端拒绝时保留本地修改，可修正后重试', async () => {
    await open()
    await changeNumber(7)
    updateSysConfig.mockRejectedValueOnce(new Error('配置被拒绝'))
    await button('保存更改').trigger('click')
    await flushPromises()
    expect(field('blog.upload-daily-limit').findComponent(ElInputNumber).props('modelValue')).toBe(7)
    expect(button('保存更改').element.disabled).toBe(false)
    expect(getSysConfig).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('空值或空图片类型列表不提交', async () => {
    await open()
    field('blog.upload.allowed-extensions').findComponent(ElSelect).vm.$emit('update:modelValue', [])
    await flushPromises()
    await button('保存更改').trigger('click')
    expect(updateSysConfig).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('保存已成功但重新读取失败时明确提示，不清掉未核对的表单', async () => {
    await open()
    await changeNumber(7)
    getSysConfig.mockRejectedValueOnce(new Error('读取失败'))
    await button('保存更改').trigger('click')
    await flushPromises()
    expect(updateSysConfig).toHaveBeenCalled()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith(expect.stringContaining('已保存，但重新读取失败'))
    expect(field('blog.upload-daily-limit').findComponent(ElInputNumber).props('modelValue')).toBe(7)
  })

  it('重置恢复环境默认值，保留其他参数尚未保存的修改', async () => {
    await open()
    await changeNumber(7)
    await field('blog.upload.storage').find('button.reset-button').trigger('click')
    await flushPromises()
    expect(resetSysConfig).toHaveBeenCalledWith('blog.upload.storage')
    expect(field('blog.upload.storage').findComponent(ElSelect).props('modelValue')).toBe('LOCAL')
    expect(field('blog.upload-daily-limit').findComponent(ElInputNumber).props('modelValue')).toBe(7)
    expect(button('保存更改').element.disabled).toBe(false)
  })

  it('取消重置不发请求，取消离开保护未保存修改', async () => {
    await open()
    ElMessageBox.confirm.mockRejectedValue('cancel')
    await field('blog.upload.storage').find('button.reset-button').trigger('click')
    await flushPromises()
    expect(resetSysConfig).not.toHaveBeenCalled()
    expect(await guard.fn()).toBe(true)
    await changeNumber(7)
    expect(await guard.fn()).toBe(false)
  })
})
