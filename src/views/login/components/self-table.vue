<!--
 * @Author: zhoubo
 * @Date: 2025-03-10 10:36:33
 * @LastEditors: zhoubo
 * @LastEditTime: 2025-03-10 11:28:02
 * @FilePath: \vertechs-table\src\views\login\components\self-table.vue
 * @Description: 文件功能描述
 * Copyright (c) 2025 by ${git_name_email}, All Rights Reserved. 
-->
<template>
  <div class="advanced-table-container" ref="tableContainerRef">
    <div class="table-toolbar" v-if="$slots.toolbar">
      <slot name="toolbar"></slot>
    </div>
    
    <!-- 虚拟滚动容器 -->
    <div 
      class="virtual-scroll-container" 
      ref="virtualScrollRef"
      @scroll="handleScroll"
      :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    >
      <!-- 用于撑开滚动区域的幽灵div -->
      <div 
        class="virtual-scroll-phantom" 
        :style="{ height: `${totalHeight}px` }"
      ></div>
      
      <!-- 表头 (固定在顶部) -->
      <div class="fixed-header-container">
        <el-table
          ref="headerTableRef"
          :data="[]"
          :show-header="true"
          :border="border"
          :stripe="stripe"
          class="header-table"
        >
          <!-- 序号列 -->
          <el-table-column
            v-if="showIndex"
            type="index"
            width="60"
            label="序号"
            fixed="left"
          />
          
          <!-- 多选列 -->
          <el-table-column
            v-if="selectionType === 'multiple'"
            width="55"
            fixed="left"
            align="center"
          >
            <template #header>
                <span>多选</span>
            </template>
          </el-table-column>
          
          <!-- 单选列 -->
          <el-table-column
            v-if="selectionType === 'single'"
            width="55"
            fixed="left"
            align="center"
          >
            <template #header>
              <span>单选</span>
            </template>
          </el-table-column>
          
          <!-- 动态列 -->
          <template v-for="column in processedColumns" :key="column.prop">
            <el-table-column
              v-bind="column"
              :fixed="column.fixed"
              :align="column.align || 'center'"
            >
              <!-- 自定义表头 -->
              <template #header v-if="column.renderHeader">
                <component :is="column.renderHeader" :column="column" />
              </template>
              
              <!-- 多级表头 -->
              <template v-if="column.children && column.children.length > 0">
                <el-table-column
                  v-for="subColumn in column.children"
                  :key="subColumn.prop"
                  v-bind="subColumn"
                  :align="subColumn.align || 'center'"
                >
                </el-table-column>
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>
      
      <!-- 表格内容 -->
      <el-table
        ref="tableRef"
        v-bind="tableAttrs"
        :data="visibleData"
        :style="{ position: 'absolute', top: `${headerHeight + offsetY}px`, width: '100%' }"
        :show-header="false"
        :row-key="rowKey"
        :border="border"
        :stripe="stripe"
        :highlight-current-row="highlightCurrentRow || selectionType === 'single'"
        :span-method="handleSpanMethod"
        @selection-change="handleSelectionChange"
        @current-change="handleCurrentChange"
        @row-click="handleRowClick"
        @sort-change="handleSortChange"
        v-loading="loading"
      >
        <!-- 序号列 -->
        <el-table-column
          v-if="showIndex"
          type="index"
          width="60"
          label="序号"
          :index="getIndex"
          fixed="left"
        />
        
        <!-- 多选列 -->
        <el-table-column
          v-if="selectionType === 'multiple'"
          type="selection"
          width="55"
          fixed="left"
        />
        
        <!-- 单选列 -->
        <el-table-column
          v-if="selectionType === 'single'"
          width="55"
          fixed="left"
          align="center"
        >
          <template #default="scope">
            <el-radio
              v-model="currentRowKey"
              :label="scope.row[rowKey]"
              @change="() => handleRadioChange(scope.row)"
            >&nbsp;</el-radio>
          </template>
        </el-table-column>
        
        <!-- 动态列 -->
        <template v-for="column in processedColumns" :key="column.prop">
          <el-table-column
            v-bind="column"
            :fixed="column.fixed"
            :align="column.align || 'center'"
            :show-overflow-tooltip="column.showOverflowTooltip !== false"
          >
            <!-- 自定义内容 -->
            <template #default="scope" v-if="!column.children">
              <slot
                :name="`column-${column.prop}`"
                :row="scope.row"
                :column="column"
                :$index="scope.$index"
              >
                <component
                  v-if="column.render"
                  :is="column.render"
                  :row="scope.row"
                  :column="column"
                  :$index="scope.$index"
                />
                <span v-else>{{ scope.row[column.prop] }}</span>
              </slot>
            </template>
            
            <!-- 多级表头 -->
            <template v-if="column.children && column.children.length > 0">
              <el-table-column
                v-for="subColumn in column.children"
                :key="subColumn.prop"
                v-bind="subColumn"
                :align="subColumn.align || 'center'"
                :show-overflow-tooltip="subColumn.showOverflowTooltip !== false"
              >
                <template #default="scope">
                  <slot
                    :name="`column-${subColumn.prop}`"
                    :row="scope.row"
                    :column="subColumn"
                    :$index="scope.$index"
                  >
                    <component
                      v-if="subColumn.render"
                      :is="subColumn.render"
                      :row="scope.row"
                      :column="subColumn"
                      :$index="scope.$index"
                    />
                    <span v-else>{{ scope.row[subColumn.prop] }}</span>
                  </slot>
                </template>
              </el-table-column>
            </template>
          </el-table-column>
        </template>
      </el-table>
      
      <!-- 内置调试信息 -->
      <div class="debug-info" v-if="showDebugInfo">
        <p>总数据: {{ props.data.length }} 条</p>
        <p>实际可见行数: {{ actualVisibleRows }} 行</p>
        <p>带缓冲区渲染行数: {{ visibleData.length }} 条</p>
        <p>当前显示范围: {{ startIndex + 1 }} - {{ endIndex }}</p>
        <p>表头高度: {{ headerHeight }}px | 内容区高度: {{ contentHeight }}px</p>
        <p>行高: {{ props.itemSize }}px | 缓冲区: {{ props.buffer }} 行</p>
        <p>选择模式: {{ props.selectionType }} | 序号列: {{ props.showIndex ? '显示' : '隐藏' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onBeforeUnmount } from 'vue';
import { ElTable, ElTableColumn, ElRadio } from 'element-plus';
import type { TableColumnCtx } from 'element-plus/es/components/table/src/table-column/defaults';
import Sortable from 'sortablejs';
import { debounce } from 'lodash-es';

// 定义类型
type SelectionType = 'none' | 'single' | 'multiple';

interface TableColumn extends Partial<TableColumnCtx<any>> {
  prop: string;
  label: string;
  children?: TableColumn[];
  render?: any;
  renderHeader?: any;
  validator?: (value: any) => boolean | string;
}

interface TableProps {
  columns: TableColumn[];
  data: any[];
  rowKey: string;
  height?: string | number;
  maxHeight?: string | number;
  border?: boolean;
  stripe?: boolean;
  showIndex?: boolean;
  selectionType?: SelectionType;
  highlightCurrentRow?: boolean;
  loading?: boolean;
  spanMethod?: (data: { row: any, column: any, rowIndex: number, columnIndex: number }) => number[] | { rowspan: number, colspan: number } | undefined;
  draggable?: boolean;
  itemSize?: number;
  buffer?: number;
  virtualScroll?: boolean;
  showDebugInfo?: boolean;
}

// 定义props
const props = withDefaults(defineProps<TableProps>(), {
  rowKey: 'id',
  height: 500,
  border: true,
  stripe: true,
  showIndex: true,
  selectionType: 'none',
  highlightCurrentRow: false,
  loading: false,
  draggable: false,
  itemSize: 40,
  buffer: 5,
  virtualScroll: true,
  showDebugInfo: false
});

// 定义事件
const emit = defineEmits([
  'selection-change',
  'current-change',
  'row-click',
  'sort-change',
  'row-drag'
]);

// 表格引用
const tableRef = ref<InstanceType<typeof ElTable> | null>(null);
const headerTableRef = ref<InstanceType<typeof ElTable> | null>(null);
const tableContainerRef = ref<HTMLElement | null>(null);
const virtualScrollRef = ref<HTMLElement | null>(null);

// 内部状态
const selectedRows = ref<any[]>([]);
const currentRow = ref<any | null>(null);
const currentRowKey = ref<string | number>('');
const visibleData = ref<any[]>([]);
const startIndex = ref(0);
const endIndex = ref(0);
const scrollTop = ref(0);
const headerHeight = ref(0);
const contentHeight = ref(0);
const actualVisibleRows = ref(0);

// 计算属性
const tableAttrs = computed(() => {
  const attrs: Record<string, any> = {
    rowKey: props.rowKey,
    border: props.border,
    stripe: props.stripe,
    highlightCurrentRow: props.highlightCurrentRow || props.selectionType === 'single',
  };
  
  return attrs;
});

// 处理列配置
const processedColumns = computed(() => {
  return props.columns.map(column => {
    // 处理验证规则
    if (!column.validator) {
      // 默认添加一个简单的非空验证
      column.validator = (value) => {
        if (value === undefined || value === null || value === '') {
          return `${column.label}是必填项`;
        }
        return true;
      };
    }
    return column;
  });
});

// 计算总高度
const totalHeight = computed(() => {
  return props.data.length * props.itemSize;
});

// 计算偏移量
const offsetY = computed(() => {
  return startIndex.value * props.itemSize;
});

// 获取序号
const getIndex = (index: number) => {
  if (props.virtualScroll) {
    return startIndex.value + index + 1;
  }
  return index + 1;
};

// 处理合并单元格
const handleSpanMethod = (data: any) => {
  if (!props.spanMethod) {
    return {
      rowspan: 1,
      colspan: 1
    };
  }
  
  try {
    // 扩展data对象，添加表格引用，用于列合并
    const enhancedData = {
      ...data,
      table: tableRef.value
    };
    
    // 如果使用虚拟滚动，调整行索引并添加虚拟滚动信息
    if (props.virtualScroll) {
      const adjustedData = {
        ...enhancedData,
        rowIndex: data.rowIndex,
        _virtualScroll: {
          startIndex: startIndex.value,
          endIndex: endIndex.value,
          visibleData: visibleData.value,
          allData: props.data
        }
      };
      return props.spanMethod(adjustedData);
    }
    
    return props.spanMethod(enhancedData);
  } catch (error) {
    console.error('Error in spanMethod:', error);
    return {
      rowspan: 1,
      colspan: 1
    };
  }
};

// 计算可见数据
const calculateVisibleData = () => {
  if (!props.virtualScroll) {
    visibleData.value = [...props.data];
    return;
  }
  
  if (!virtualScrollRef.value || !props.data || props.data.length === 0) return;
  
  // 测量表头高度（如果尚未测量）
  if (headerHeight.value === 0) {
    measureHeaderHeight();
  }
  
  // 获取容器高度
  const containerHeight = typeof props.height === 'number' ? props.height : 500;
  
  // 计算内容区域高度（容器高度减去表头高度）
  contentHeight.value = containerHeight - headerHeight.value;
  
  // 计算实际可见行数（向下取整，确保不会多渲染）
  
  const visibleRows = Math.floor(contentHeight.value / props.itemSize);
  console.log('实际可见行数:', visibleRows,contentHeight.value);
  actualVisibleRows.value = visibleRows;
  
  // 增加缓冲区大小，特别是当使用了合并单元格时
  const bufferRows = props.spanMethod ? ( props.buffer * 2): props.buffer;
  
  // 计算总的可见行数（可见 + 缓冲）
  const visibleCount = visibleRows + bufferRows;
  
  // 计算起始索引，考虑缓冲区
  const newStartIndex = Math.max(0, Math.floor(scrollTop.value / props.itemSize) - bufferRows);
  
  // 计算结束索引，不超过数据总长度
  const newEndIndex = Math.min(props.data.length, newStartIndex + visibleCount);
  
  // 当使用合并单元格时，我们需要更频繁地更新可见数据
  const shouldUpdate = 
    visibleData.value.length === 0 || // 首次渲染
    props.spanMethod != null || // 使用了合并单元格
    Math.abs(newStartIndex - startIndex.value) >= 1 || // 滚动超过一行
    newStartIndex === 0 || // 首页数据
    newEndIndex === props.data.length; // 尾页数据
  
  if (!shouldUpdate) {
    return;
  }
  
  // 更新索引
  startIndex.value = newStartIndex;
  endIndex.value = newEndIndex;
  // 提取可见数据
  visibleData.value = props.data.slice(startIndex.value, endIndex.value);
  
  // 确保数据已经更新后再触发表格重新布局
  nextTick(() => {
    tableRef.value?.doLayout();
    syncColumnWidths();
    
    // 如果使用了单选模式，需要设置当前选中行
    if (props.selectionType === 'single' && currentRowKey.value) {
      const selectedRow = visibleData.value.find(row => row[props.rowKey] === currentRowKey.value);
      if (selectedRow) {
        tableRef.value?.setCurrentRow(selectedRow);
      }
    }
  });
  
  console.log('虚拟滚动计算结果:', {
    containerHeight,
    headerHeight: headerHeight.value,
    contentHeight: contentHeight.value,
    actualVisibleRows: visibleRows,
    bufferRows,
    scrollTop: scrollTop.value,
    itemSize: props.itemSize,
    visibleCount,
    startIndex: startIndex.value,
    endIndex: endIndex.value,
    visibleDataLength: visibleData.value.length,
    totalDataLength: props.data.length,
    hasMergeMethod: props.spanMethod != null
  });
};

// 处理表格滚动
const handleScroll = debounce(() => {
  if (!virtualScrollRef.value || !props.virtualScroll) return;
  
  // 获取当前滚动位置
  scrollTop.value = virtualScrollRef.value.scrollTop;
  
  // 重新计算可见数据
  calculateVisibleData();
  
  // 如果使用了合并单元格，每次滚动都需要刷新表格
  if (props.spanMethod) {
    nextTick(() => {
      tableRef.value?.doLayout();
    });
  }
}, props.spanMethod ? 8 : 16); // 使用合并单元格时，减少防抖时间，提高响应速度

// 同步表头和内容表格的列宽
const syncColumnWidths = () => {
  if (!tableRef.value || !headerTableRef.value) return;
  
  nextTick(() => {
    // 获取内容表格的列宽
    const contentCols = tableRef.value.$el.querySelectorAll('colgroup col');
    const headerCols = headerTableRef.value.$el.querySelectorAll('colgroup col');
    
    if (contentCols.length === headerCols.length) {
      for (let i = 0; i < contentCols.length; i++) {
        const width = contentCols[i].getAttribute('width');
        if (width) {
          headerCols[i].setAttribute('width', width);
        }
      }
    }
  });
};

// 初始化拖拽功能
const initDraggable = () => {
  if (!props.draggable || !tableRef.value) return;
  
  const tbody = tableRef.value.$el.querySelector('.el-table__body tbody');
  if (!tbody) return;
  
  Sortable.create(tbody, {
    handle: '.el-table__row',
    animation: 150,
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex !== newIndex) {
        const currentData = [...visibleData.value];
        const targetRow = currentData[oldIndex];
        currentData.splice(oldIndex, 1);
        currentData.splice(newIndex, 0, targetRow);
        
        // 更新显示数据
        visibleData.value = currentData;
        
        // 触发拖拽事件
        emit('row-drag', {
          row: targetRow,
          oldIndex: props.virtualScroll ? startIndex.value + oldIndex : oldIndex,
          newIndex: props.virtualScroll ? startIndex.value + newIndex : newIndex,
          visibleData: visibleData.value,
          allData: props.data
        });
      }
    }
  });
};

// 测量表头高度
const measureHeaderHeight = () => {
  if (!headerTableRef.value) return;
  
  nextTick(() => {
    const headerEl = headerTableRef.value.$el;
    if (headerEl) {
      const measuredHeight = headerEl.offsetHeight;
      
      // 如果高度异常（太小或太大），使用合理的默认值
      if (measuredHeight < 20 || measuredHeight > 200) {
        headerHeight.value = 40; // 默认表头高度
      } else {
        headerHeight.value = measuredHeight;
      }
      
      console.log('Header height measured:', headerHeight.value);
      
      // 重新计算内容区域高度
      const containerHeight = typeof props.height === 'number' ? props.height : 500;
      contentHeight.value = containerHeight - headerHeight.value;
      
      // 重新计算可见行数
      actualVisibleRows.value = Math.floor(contentHeight.value / props.itemSize);
    }
  });
};

// 处理单选框变更
const handleRadioChange = (row: any) => {
  currentRow.value = row;
  selectedRows.value = [row];
  tableRef.value?.setCurrentRow(row);
  emit('selection-change', [row]);
  emit('current-change', row);
};

// 处理事件
const handleSelectionChange = (selection: any[]) => {
  // 只在多选模式下处理
  if (props.selectionType === 'multiple') {
    selectedRows.value = selection;
    emit('selection-change', selection);
  }
};

const handleCurrentChange = (row: any) => {
  // 只在单选模式下处理
  if (props.selectionType === 'single') {
    currentRow.value = row;
    if (row) {
      currentRowKey.value = row[props.rowKey];
      selectedRows.value = [row];
      emit('selection-change', [row]);
    } else {
      currentRowKey.value = '';
      selectedRows.value = [];
      emit('selection-change', []);
    }
  }
  
  emit('current-change', row);
};

const handleRowClick = (row: any, column: any, event: Event) => {
  if (props.selectionType === 'single') {
    currentRowKey.value = row[props.rowKey];
    tableRef.value?.setCurrentRow(row);
    selectedRows.value = [row];
    emit('selection-change', [row]);
  }
  emit('row-click', row, column, event);
};

const handleSortChange = (params: any) => {
  emit('sort-change', params);
};

// 公开方法
const clearSelection = () => {
  if (props.selectionType === 'multiple') {
    tableRef.value?.clearSelection();
  } else if (props.selectionType === 'single') {
    currentRowKey.value = '';
    currentRow.value = null;
    tableRef.value?.setCurrentRow(null);
    selectedRows.value = [];
    emit('selection-change', []);
  }
};

const toggleRowSelection = (row: any, selected?: boolean) => {
  if (props.selectionType === 'multiple') {
    tableRef.value?.toggleRowSelection(row, selected);
  } else if (props.selectionType === 'single' && selected !== false) {
    currentRowKey.value = row[props.rowKey];
    currentRow.value = row;
    tableRef.value?.setCurrentRow(row);
    selectedRows.value = [row];
    emit('selection-change', [row]);
  }
};

const toggleAllSelection = () => {
  if (props.selectionType === 'multiple') {
    tableRef.value?.toggleAllSelection();
  }
};

const setCurrentRow = (row: any) => {
  if (props.selectionType === 'single') {
    currentRowKey.value = row ? row[props.rowKey] : '';
    currentRow.value = row;
    tableRef.value?.setCurrentRow(row);
    selectedRows.value = row ? [row] : [];
    emit('selection-change', selectedRows.value);
  } else {
    tableRef.value?.setCurrentRow(row);
  }
};

const refreshTable = () => {
  nextTick(() => {
    tableRef.value?.doLayout();
    headerTableRef.value?.doLayout();
    measureHeaderHeight();
    calculateVisibleData();
    syncColumnWidths();
  });
};

// 滚动到指定索引
const scrollToIndex = (index: number) => {
  if (!virtualScrollRef.value || !props.virtualScroll) return;
  
  // 计算目标位置
  const targetScrollTop = index * props.itemSize;
  
  // 设置滚动位置
  virtualScrollRef.value.scrollTop = targetScrollTop;
  scrollTop.value = targetScrollTop;
  
  // 重新计算可见数据
  calculateVisibleData();
};

// 更新缓冲区大小
const updateBuffer = (newBuffer: number) => {
  // 更新内部状态
  const oldBuffer = props.buffer;
  
  // 使用响应式对象暂存props
  const propsRef = ref(props);
  propsRef.value.buffer = newBuffer;
  
  // 重新计算可见数据
  calculateVisibleData();
  
  console.log(`缓冲区大小已更新: ${oldBuffer} -> ${newBuffer}`);
};

// 更新行高
const updateItemSize = (newItemSize: number) => {
  // 更新内部状态
  const oldItemSize = props.itemSize;
  
  // 使用响应式对象暂存props
  const propsRef = ref(props);
  propsRef.value.itemSize = newItemSize;
  
  // 重置滚动位置
  if (virtualScrollRef.value) {
    virtualScrollRef.value.scrollTop = 0;
    scrollTop.value = 0;
  }
  
  // 重新计算可见数据
  calculateVisibleData();
  
  // 更新表格样式
  document.documentElement.style.setProperty('--table-row-height', `${newItemSize}px`);
  
  console.log(`行高已更新: ${oldItemSize}px -> ${newItemSize}px`);
};

// 生命周期钩子
onMounted(() => {
  // 设置行高CSS变量
  document.documentElement.style.setProperty('--table-row-height', `${props.itemSize}px`);
  
  // 初始计算可见数据
  nextTick(() => {
    if (props.virtualScroll) {
      // 获取虚拟滚动容器
      virtualScrollRef.value = tableContainerRef.value?.querySelector('.virtual-scroll-container') || null;
      
      // 添加滚动事件监听
      if (virtualScrollRef.value) {
        virtualScrollRef.value.addEventListener('scroll', handleScroll);
      }
      
      // 测量表头高度
      measureHeaderHeight();
    }
    
    calculateVisibleData();
    initDraggable();
    
    // 同步列宽
    setTimeout(() => {
      syncColumnWidths();
    }, 100);
  });
  
  // 监听窗口大小变化
  window.addEventListener('resize', refreshTable);
});

onBeforeUnmount(() => {
  if (virtualScrollRef.value && props.virtualScroll) {
    virtualScrollRef.value.removeEventListener('scroll', handleScroll);
  }
  
  window.removeEventListener('resize', refreshTable);
  
  // 清除防抖函数
  (handleScroll as any).cancel();
});

// 监听props变化
watch(() => props.data, () => {
  // 数据变化时重新计算
  nextTick(() => {
    // 重置滚动位置
    if (virtualScrollRef.value && props.virtualScroll) {
      virtualScrollRef.value.scrollTop = 0;
      scrollTop.value = 0;
    }
    calculateVisibleData();
    
    // 同步列宽
    setTimeout(() => {
      syncColumnWidths();
    }, 100);
  });
}, { deep: true });

watch(() => props.columns, () => {
  nextTick(() => {
    syncColumnWidths();
  });
}, { deep: true });

// 监听选择模式变化
watch(() => props.selectionType, () => {
  // 清除选择
  clearSelection();
  
  // 刷新表格
  nextTick(() => {
    refreshTable();
  });
});

// 监听序号列显示变化
watch(() => props.showIndex, () => {
  nextTick(() => {
    refreshTable();
  });
});

// 暴露方法
defineExpose({
  tableRef,
  headerTableRef,
  clearSelection,
  toggleRowSelection,
  toggleAllSelection,
  setCurrentRow,
  refreshTable,
  scrollToIndex,
  updateBuffer,
  updateItemSize,
  selectedRows,
  currentRow,
  startIndex,
  endIndex,
  visibleData,
  actualVisibleRows,
  headerHeight,
  contentHeight
});
</script>

<style scoped lang="scss">
.advanced-table-container {
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.table-toolbar {
  margin-bottom: 16px;
}

.virtual-scroll-container {
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
}

.virtual-scroll-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: -1;
}

.fixed-header-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #fff;
  width: 100%;
}

:deep(.el-table__row) {
  cursor: pointer;
  height: var(--table-row-height, v-bind('props.itemSize + "px"'));
}

:deep(.el-table .cell) {
  word-break: break-all;
}

/* 优化表格性能 */
:deep(.el-table) {
  will-change: transform;
}
:deep(.el-tag){
    height: 20px;
}
:deep(.el-table__body) {
  will-change: transform;
}

/* 隐藏表头表格的内容部分 */
.header-table :deep(.el-table__body-wrapper) {
  display: none;
}

/* 处理固定列 */
:deep(.el-table__fixed),
:deep(.el-table__fixed-right) {
  position: absolute;
  top: 0;
  z-index: 1;
}

:deep(.el-table__fixed-header-wrapper),
:deep(.el-table__fixed-right-header-wrapper) {
  z-index: 2;
}

/* 确保内容表格没有边框重叠 */
:deep(.el-table__header-wrapper) {
  border-bottom: none;
}

:deep(.el-table__body-wrapper) {
  border-top: none;
}
/* 单选按钮样式优化 */
:deep(.el-radio) {
  margin-right: 0;
}

:deep(.el-radio__input) {
  vertical-align: middle;
}

:deep(.el-radio__label) {
  display: none;
}

/* 调试信息样式 */
.debug-info {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
  max-width: 300px;
}

.debug-info p {
  margin: 5px 0;
}
</style>
