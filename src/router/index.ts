import { createRouter, createWebHistory, RouteRecordRaw,createWebHashHistory,Router } from 'vue-router'
import Layout from "@/layout/index.vue";

interface extendRoute {
  hidden?:boolean
}

/**
 * alwaysShow 如果设置为true，将始终显示根菜单，无论其子路由长度如何
 * hidden 如果“hidden:true”不会显示在侧边栏中（默认值为false）
 * keepAlive 设为true 缓存
 */


export const constantRoutes: Array<RouteRecordRaw&extendRoute> = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    hidden: true,
    meta: { title: '登录',}
  },


]

const router = createRouter({
  // history: createWebHistory(process.env.BASE_URL), // history
  history: createWebHashHistory(), // hash
  routes:constantRoutes
})




export default router
