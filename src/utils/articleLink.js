// 文章详情站内路径（Zer0Drv/blog#14）：优先 slug 固定链接，slug 缺失回退 id
// （两条路由都有效，旧 id 链接不破坏）。仅用于能拿到文章对象（含 slug）的公众端列表；
// 管理端列表、通知跳转等只有 id 的场景继续用 `/article/${id}`，slug 改链也不受影响。
export function articlePath(article) {
  return `/article/${article?.slug || article?.id}`
}
