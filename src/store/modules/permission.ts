import {Module} from "vuex";

import { constantRoutes } from '@/router/index'
/**
 * 使用 meta.role 来确定当前用户是否具有权限
 * @param roles
 * @param route
 */
function hasPermission(roles, route) {
    console.log(roles,'roles');
    
    if (route.meta && route.meta.roles) {
        return roles.some(role => route.meta.roles.includes(role))
    } else {
        // return true
        return false
    }
}




const state = {
    routes: [],
    addRoutes: []
}

const mutations = {
    SET_ROUTES: (state, routes) => {
        state.addRoutes = routes
        state.routes = constantRoutes.concat(routes)
    },
    CLEAR_ROUTERS:(state, routes) => {
        state.addRoutes = []
        state.routes = []
    },
}

const actions = {
   
}

const permission:Module<any, any> = {
    namespaced:true,
    state,
    mutations,
    actions
}

export default permission
