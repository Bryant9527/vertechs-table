<template>
  <div class="table-demo">
    <div class="toolbar">
      <el-button type="danger" @click="deleteSelected">删除选中</el-button>
      <excel-import 
        :columns="exportColumns" 
        @import-success="handleImportSuccess"
        @import-error="handleImportError"
      />
      <el-button type="success" @click="exportToExcel">导出Excel</el-button>
    </div>
    
    <!-- 调试信息 -->
    <div class="debug-info">
      <p>总数据: {{ tableData.length }} 条</p>
      <p>实际可见行数: {{ actualVisibleRows }} 行</p>
    </div>
    
    <!-- 表格控制选项 -->
    <div class="table-options">
      <!-- 合并列单元格选项 -->
      <div class="option-group">
        <div class="option-label">列合并：</div>
        <el-radio-group v-model="mergeColumns" @change="updateColumnMerge">
          <el-radio-button label="column">启用</el-radio-button>
          <el-radio-button label="none">禁用</el-radio-button>
        </el-radio-group>
      </div>
      
      <!-- 合并行单元格选项 -->
      <div class="option-group">
        <div class="option-label">行合并：</div>
        <el-radio-group v-model="mergeDirection" @change="updateMergeMethod">
          <el-radio-button label="row">启用</el-radio-button>
          <el-radio-button label="none">禁用</el-radio-button>
        </el-radio-group>
        
        <div v-if="mergeDirection !== 'none'" class="merge-columns">
          <el-checkbox-group v-model="mergeCols" @change="updateMergeMethod">
            <el-checkbox label="department">部门</el-checkbox>
            <el-checkbox label="position">职位</el-checkbox>
            <el-checkbox label="status">状态</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
      
      <!-- 选择模式选项 -->
      <div class="option-group">
        <div class="option-label">选择模式：</div>
        <el-radio-group v-model="selectionType" @change="updateSelectionType">
          <el-radio-button label="multiple">多选</el-radio-button>
          <el-radio-button label="single">单选</el-radio-button>
          <el-radio-button label="none">不可选</el-radio-button>
        </el-radio-group>
      </div>
      
      <!-- 序号列选项 -->
      <div class="option-group">
        <div class="option-label">序号列：</div>
        <el-radio-group v-model="showIndexColumn" @change="updateShowIndex">
          <el-radio-button :label="true">显示</el-radio-button>
          <el-radio-button :label="false">隐藏</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    
    <advanced-table
      ref="tableRef"
      :columns="displayColumns"
      :data="tableData"
      :row-key="'id'"
      :height="500"
      :selection-type="selectionType"
      :show-index="showIndexColumn"
      :span-method="spanMethod"
      :draggable="true"
      :item-size="40"
      :buffer="5"
      :show-debugInfo="true"
      :virtual-scroll="true"
      :loading="loading"
      @selection-change="handleSelectionChange"
      @row-drag="handleRowDrag"
    >
      <template #column-status="{ row }">
        <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
      </template>
    </advanced-table>
 
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as XLSX from 'xlsx';
import AdvancedTable from './components/self-table.vue';
import ExcelImport from './components/import-excel.vue';
import { createSpanMethod } from '@/utils/tableMerge';

// 原始表格列定义 - 嵌套结构（启用列合并）
const nestedColumns = ref([
  {
    prop: 'name',
    label: '姓名',
    width: 120,
    fixed: 'left',
    validator: (value: string) => {
      if (!value) return '姓名是必填项';
      if (value.length < 2) return '姓名长度不能小于2个字符';
      return true;
    }
  },
  {
    prop: 'department',
    label: '部门',
    width: 150,
    validator: (value: string) => {
      if (!value) return '部门是必填项';
      return true;
    }
  },
  {
    prop: 'position',
    label: '职位',
    width: 150
  },
  {
    label: '联系方式',
    children: [
      {
        prop: 'phone',
        label: '电话',
        width: 150,
        validator: (value: string) => {
          if (!value) return '电话是必填项';
          if (!/^1[3-9]\d{9}$/.test(value)) return '电话格式不正确';
          return true;
        }
      },
      {
        prop: 'email',
        label: '邮箱',
        width: 200,
        validator: (value: string) => {
          if (!value) return '邮箱是必填项';
          if (!/^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(value)) return '邮箱格式不正确';
          return true;
        }
      }
    ]
  },
  {
    prop: 'joinDate',
    label: '入职日期',
    width: 150,
    validator: (value: string) => {
      if (!value) return '入职日期是必填项';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '日期格式应为YYYY-MM-DD';
      return true;
    }
  },
  {
    prop: 'salary',
    label: '薪资',
    width: 120,
    validator: (value: any) => {
      if (value === undefined || value === null) return '薪资是必填项';
      if (isNaN(Number(value)) || Number(value) <= 0) return '薪资必须为正数';
      return true;
    }
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    validator: (value: string) => {
      const validStatus = ['在职', '离职', '休假'];
      if (!value) return '状态是必填项';
      if (!validStatus.includes(value)) return '状态只能是在职、离职或休假';
      return true;
    }
  },
]);

// 拆分列的配置 - 将电话和邮箱拆分为独立列（禁用列合并）
const flatColumns = ref([
  {
    prop: 'name',
    label: '姓名',
    width: 120,
    fixed: 'left',
    validator: (value: string) => {
      if (!value) return '姓名是必填项';
      if (value.length < 2) return '姓名长度不能小于2个字符';
      return true;
    }
  },
  {
    prop: 'department',
    label: '部门',
    width: 150,
    validator: (value: string) => {
      if (!value) return '部门是必填项';
      return true;
    }
  },
  {
    prop: 'position',
    label: '职位',
    width: 150
  },
  // 拆分为独立的电话列
  {
    prop: 'phone',
    label: '电话',
    width: 150,
    validator: (value: string) => {
      if (!value) return '电话是必填项';
      if (!/^1[3-9]\d{9}$/.test(value)) return '电话格式不正确';
      return true;
    }
  },
  // 拆分为独立的邮箱列
  {
    prop: 'email',
    label: '邮箱',
    width: 200,
    validator: (value: string) => {
      if (!value) return '邮箱是必填项';
      if (!/^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(value)) return '邮箱格式不正确';
      return true;
    }
  },
  {
    prop: 'joinDate',
    label: '入职日期',
    width: 150,
    validator: (value: string) => {
      if (!value) return '入职日期是必填项';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '日期格式应为YYYY-MM-DD';
      return true;
    }
  },
  {
    prop: 'salary',
    label: '薪资',
    width: 120,
    validator: (value: any) => {
      if (value === undefined || value === null) return '薪资是必填项';
      if (isNaN(Number(value)) || Number(value) <= 0) return '薪资必须为正数';
      return true;
    }
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    validator: (value: string) => {
      const validStatus = ['在职', '离职', '休假'];
      if (!value) return '状态是必填项';
      if (!validStatus.includes(value)) return '状态只能是在职、离职或休假';
      return true;
    }
  },
]);

// 表格列合并状态
const mergeColumns = ref('column'); // 默认启用列合并
const mergeDirection = ref<'row' | 'none'>('row');
const mergeCols = ref(['department', 'position']); // 默认合并部门和职位列
const selectionType = ref<'multiple' | 'single' | 'none'>('multiple');
const showIndexColumn = ref(true);

// 根据列合并状态选择显示的列配置
const displayColumns = computed(() => {
  return mergeColumns.value === 'column' ? nestedColumns.value : flatColumns.value;
});

// 用于导出和导入的列配置（使用嵌套结构以保持一致性）
const exportColumns = computed(() => {
  return nestedColumns.value;
});

// 表格数据
const tableData = ref<any[]>([]);
const selectedRows = ref<any[]>([]);
const tableRef = ref<any>(null);
const dialogVisible = ref(false);
const editForm = ref<any>({});
const currentEditRow = ref<any>(null);
const loading = ref(false);

// 计算虚拟滚动信息
const startIndex = computed(() => tableRef.value?.startIndex || 0);
const endIndex = computed(() => tableRef.value?.endIndex || 0);
const visibleCount = computed(() => tableRef.value?.visibleData?.length || 0);
const actualVisibleRows = computed(() => tableRef.value?.actualVisibleRows || 0);

// 单元格合并方法
const spanMethod = ref<any>(null);

// 更新列合并状态
const updateColumnMerge = () => {
  // 刷新表格
  if (tableRef.value) {
    tableRef.value.refreshTable();
  }
};

// 更新行合并方法
const updateMergeMethod = () => {
  // 处理行合并
  if (mergeDirection.value === 'none') {
    spanMethod.value = null;
  } else {
    spanMethod.value = createSpanMethod({
      props: mergeCols.value,
      direction: mergeDirection.value,
      auto: false
    });
  }
  
  // 刷新表格
  if (tableRef.value) {
    tableRef.value.refreshTable();
  }
};

// 更新选择模式
const updateSelectionType = () => {
  // 清除已选中的行
  selectedRows.value = [];
  
  // 刷新表格
  if (tableRef.value) {
    tableRef.value.refreshTable();
  }
};

// 更新序号列显示
const updateShowIndex = () => {
  // 刷新表格
  if (tableRef.value) {
    tableRef.value.refreshTable();
  }
};

// 生成模拟数据
const generateMockData = (count: number) => {
  const data = [];
  const departments = ['研发部', '市场部', '销售部', '人力资源部', '财务部'];
  const positions = ['经理', '主管', '专员', '助理', '实习生'];
  const statuses = ['在职', '离职', '休假'];
  
  // 生成数据时，确保有大块的相同值，便于展示合并效果
  for (let i = 0; i < count; i++) {
    // 每10行使用相同的部门（更容易测试合并效果）
    const deptIndex = Math.floor(i / 10) % departments.length;
    // 每5行使用相同的职位
    const posIndex = Math.floor(i / 5) % positions.length;
    // 每3行使用相同的状态
    const statusIndex = Math.floor(i / 3) % statuses.length;
    
    data.push({
      id: `user_${i + 1}`,
      name: `用户${i + 1}`,
      department: departments[deptIndex],
      position: positions[posIndex],
      phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
      email: `user${i + 1}@example.com`,
      joinDate: `202${Math.floor(i / 1000) % 5}-${String(Math.floor(i / 30) % 12 + 1).padStart(2, '0')}-${String(Math.floor(i / 10) % 28 + 1).padStart(2, '0')}`,
      salary: 5000 + Math.floor(i / 20) * 1000,
      status: statuses[statusIndex]
    });
  }
  
  return data;
};

// 处理表格事件
const handleSelectionChange = (selection: any[]) => {
  selectedRows.value = selection;
};

const handleRowDrag = (params: any) => {
  console.log('Row dragged:', params);
  ElMessage.success(`行已移动: 从第${params.oldIndex + 1}行到第${params.newIndex + 1}行`);
};

// 获取状态标签类型
const getStatusType = (status: string) => {
  switch (status) {
    case '在职':
      return 'success';
    case '离职':
      return 'danger';
    case '休假':
      return 'warning';
    default:
      return 'info';
  }
};

// 可编辑的列
const editableColumns = computed(() => {
  const result = [];
  
  for (const col of nestedColumns.value) {
    if (col.children) {
      result.push(...col.children.filter(subCol => subCol.prop !== 'operation'));
    } else if (col.prop !== 'operation') {
      result.push(col);
    }
  }
  
  return result;
});

const editRow = (row: any) => {
  editForm.value = { ...row };
  currentEditRow.value = row;
  dialogVisible.value = true;
};

const saveEdit = () => {
  // 验证表单
  let hasError = false;
  
  for (const col of editableColumns.value) {
    if (col.validator) {
      const result = col.validator(editForm.value[col.prop]);
      if (result !== true) {
        ElMessage.error(result);
        hasError = true;
        break;
      }
    }
  }
  
  if (hasError) return;
  
  if (currentEditRow.value) {
    // 更新现有行
    const index = tableData.value.findIndex(item => item.id === currentEditRow.value.id);
    if (index !== -1) {
      tableData.value[index] = { ...editForm.value };
    }
  } else {
    // 添加新行
    tableData.value.unshift({ ...editForm.value });
  }
  
  dialogVisible.value = false;
  ElMessage.success('保存成功');
  
  // 刷新表格
  if (tableRef.value) {
    tableRef.value.refreshTable();
  }
};

const deleteRow = (row: any) => {
  ElMessageBox.confirm('确定要删除此行数据吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const index = tableData.value.findIndex(item => item.id === row.id);
    if (index !== -1) {
      tableData.value.splice(index, 1);
      ElMessage.success('删除成功');
      
      // 刷新表格
      if (tableRef.value) {
        tableRef.value.refreshTable();
      }
    }
  }).catch(() => {});
};

const deleteSelected = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的行');
    return;
  }
  
  ElMessageBox.confirm(`确定要删除选中的${selectedRows.value.length}行数据吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const selectedIds = selectedRows.value.map(row => row.id);
    tableData.value = tableData.value.filter(row => !selectedIds.includes(row.id));
    ElMessage.success('删除成功');
    
    // 刷新表格
    if (tableRef.value) {
      tableRef.value.refreshTable();
    }
  }).catch(() => {});
};

// Excel导入导出
const handleImportSuccess = async (data: any[]) => {
  loading.value = true; // 显示加载状态
  
  try {
    // 添加ID
    const importedData = data.map((item, index) => ({
      id: `imported_${Date.now()}_${index}`,
      ...item
    }));
    
    // 创建新数组而不是修改原数组
    const newTableData = [...importedData, ...tableData.value];
    
    // 先清空数据，触发组件重置
    tableData.value = [];
    
    // 等待DOM更新
    await nextTick();
    
    // 再设置新数据
    tableData.value = newTableData;
    
    // 等待DOM更新
    await nextTick();
    
    // 刷新表格
    if (tableRef.value) {
      tableRef.value.refreshTable();
      
      // 如果使用了虚拟滚动，滚动到顶部
      if (tableRef.value.scrollToIndex) {
        tableRef.value.scrollToIndex(0);
      }
    }
    
    ElMessage.success(`成功导入${importedData.length}条数据`);
  } finally {
    // 延迟关闭加载状态，确保UI已更新
    setTimeout(() => {
      loading.value = false;
    }, 300);
  }
};

const handleImportError = (errors: string[]) => {
  console.error('导入错误:', errors);
};

const exportToExcel = () => {
  // 准备表头
  const headers: string[] = [];
  const flatColumns: any[] = [];
  
  // 使用原始列配置导出
  nestedColumns.value.forEach(col => {
    if (col.children) {
      col.children.forEach(subCol => {
        if (subCol.prop !== 'operation') {
          headers.push(subCol.label);
          flatColumns.push(subCol);
        }
      });
    } else if (col.prop !== 'operation') {
      headers.push(col.label);
      flatColumns.push(col);
    }
  });
  
  // 准备数据
  const rows = tableData.value.map(row => {
    return flatColumns.map(col => row[col.prop]);
  });
  
  // 创建工作表
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  
  // 创建工作簿
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '员工数据');
  
  // 导出文件
  XLSX.writeFile(workbook, `员工数据_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// 生命周期钩子
onMounted(() => {
  // 显示加载中状态
  loading.value = true;
  
  // 初始加载模拟数据
  setTimeout(() => {
    tableData.value = generateMockData(10000);
    
    // 确保表格组件已经挂载
    nextTick(() => {
      // 初始化合并方法
      updateMergeMethod();
      
      if (tableRef.value) {
        tableRef.value.refreshTable();
      }
      loading.value = false;
    });
  }, 0);
});
</script>

<style scoped lang="scss">
.table-demo {
  padding: 20px;
}

.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.debug-info {
  background-color: #f0f9eb;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #67c23a;
}

.table-options {
  margin-bottom: 16px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.option-label {
  font-weight: bold;
  min-width: 80px;
}

.merge-columns {
  margin-left: 20px;
}
</style>
