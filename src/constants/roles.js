// 角色常量层（零依赖）：router meta.roles 与 auth store getter 共用，消除散落的 'ADMIN'/'AUTHOR' 字面量
// 注意：取值必须与后端 User.role 一致；后端普通用户为 'USER'
export const ROLES = {
  ADMIN: 'ADMIN',
  AUTHOR: 'AUTHOR',
  USER: 'USER'
}

// 角色组：写作者（可发文/进编辑器）
export const ROLE_GROUPS = {
  WRITERS: [ROLES.ADMIN, ROLES.AUTHOR]
}
