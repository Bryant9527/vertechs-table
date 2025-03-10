<template>
  <section class="app-main"  v-if="isReload">
        <router-view v-slot="{ Component,route }">
          <transition name="fade-slide" mode="out-in" appear>
            <keep-alive v-if="route.meta&&route.meta.keepAlive">
              <component :is="Component" :key="route.path" />
            </keep-alive>
            <component :is="Component" :key="route.path" v-else/>
          </transition>
        </router-view>
      <u-setting/>
  </section>
</template>

<script lang="ts" setup>
import USetting from '@/components/u-setting/index.vue'
import { useStore } from 'vuex'
import { computed, ref } from 'vue'
const store = useStore()

const cachedViews = computed(() => {
  return store.state.tagsView.cachedViews
})

const isReload = computed(() => {
  return store.state.app.isReload
})
</script>

<style lang="scss" scoped>
  .app-main{
    overflow: hidden;
    box-sizing: border-box;
  }
</style>
